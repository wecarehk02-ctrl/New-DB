import React, { useState, useEffect } from 'react';
import { 
  Users, ClipboardList, Printer, FileSpreadsheet, ChefHat, 
  Upload, Search, Plus, Download, Edit2, Check, X, Calendar as CalendarIcon, Soup
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, query, where } from 'firebase/firestore';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase'; 

const TEXTURES = ['正', '碎', '免治', '分糊', '全糊'];
const MEALS = ['A', 'B', 'C'];
const ZONES = ['沙田及北區線', '葵青荃灣線', '觀塘線', '屯元天線', '土瓜環步兵', '團體線'];

export default function WeCareProSystem() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('customers'); 
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menuNames, setMenuNames] = useState({ A: '', B: '', C: '', Soup: '' });
  
  // 管理狀態
  const [selectedCustomer, setSelectedCustomer] = useState(null); // 用於彈出月曆視窗
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); // 0-11
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    onAuthStateChanged(auth, (user) => setIsAuthenticated(!!user));
    if (isAuthenticated) {
      onSnapshot(collection(db, "customers"), (s) => setCustomers(s.docs.map(d => d.data()).sort((a,b) => a.id - b.id)));
      onSnapshot(doc(db, "menus", selectedDate), (d) => setMenuNames(d.exists() ? d.data() : { A: '', B: '', C: '', Soup: '' }));
      onSnapshot(query(collection(db, "orders"), where("date", "==", selectedDate)), (s) => setOrders(s.docs.map(d => d.data())));
    }
  }, [isAuthenticated, selectedDate]);

  // --- 橫向 Mass Import (1-31號) ---
  const handleMassImport = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

      for (let row of data) {
        const custId = String(row["客戶ID"]);
        const texture = row["規格"] || "正";

        for (let day = 1; day <= 31; day++) {
          const val = row[`${day}號`]?.toUpperCase(); // 例如 "A", "AS" (A餐連湯), "A-" (A餐走湯)
          if (!val) continue;

          const dateStr = `${monthPrefix}-${String(day).padStart(2, '0')}`;
          const mealType = val[0]; // A, B, or C
          const skipSoup = val.includes('-') || val.includes('走'); 

          await setDoc(doc(db, "orders", `${dateStr}_${custId}`), {
            date: dateStr,
            customerId: custId,
            counts: { [`${mealType}_${texture}`]: 1 },
            noSoup: skipSoup,
            notes: ""
          }, { merge: true });
        }
      }
      alert("全月訂單導入成功！");
    };
    reader.readAsBinaryString(file);
  };

  // --- 廚房報表導出 ---
  const exportKitchenExcel = () => {
    const report = TEXTURES.map(t => {
      const row = { "規格": t };
      MEALS.forEach(m => {
        row[`${m}餐`] = orders.reduce((sum, o) => sum + (o.counts?.[`${m}_${t}`] || 0), 0);
      });
      return row;
    });
    // 計算總湯數 (排除 noSoup: true 的單)
    const totalSoup = orders.reduce((sum, o) => {
      const hasMeal = Object.values(o.counts || {}).some(v => v > 0);
      return sum + (hasMeal && !o.noSoup ? 1 : 0);
    }, 0);
    report.push({ "規格": "總計", "例湯總量": totalSoup });

    const ws = XLSX.utils.json_to_sheet(report);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "廚房備餐表");
    XLSX.writeFile(wb, `Kitchen_${selectedDate}.xlsx`);
  };

  // --- 客戶月曆組件 ---
  const CustomerCalendar = ({ customer }) => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const [custOrders, setCustOrders] = useState([]);

    useEffect(() => {
      const start = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-01`;
      const end = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-31`;
      const q = query(collection(db, "orders"), where("customerId", "==", customer.id), where("date", ">=", start), where("date", "<=", end));
      getDocs(q).then(s => setCustOrders(s.docs.map(d => d.data())));
    }, [customer.id, currentMonth]);

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-auto p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold">{customer.name} - {currentMonth + 1}月訂餐明細</h3>
            <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-slate-100 rounded-full"><X/></button>
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {[...Array(daysInMonth)].map((_, i) => {
              const day = i + 1;
              const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const dayOrder = custOrders.find(o => o.date === dateStr) || { counts: {}, noSoup: false };
              
              return (
                <div key={day} className="border p-2 rounded-xl min-h-[100px] bg-slate-50 flex flex-col justify-between">
                  <div className="font-bold text-slate-400">{day}</div>
                  <div className="space-y-1">
                    <select 
                      value={Object.keys(dayOrder.counts || {}).find(k => dayOrder.counts[k] > 0)?.split('_')[0] || ''} 
                      onChange={async (e) => {
                        const meal = e.target.value;
                        const orderId = `${dateStr}_${customer.id}`;
                        await setDoc(doc(db, "orders", orderId), {
                          date: dateStr, customerId: customer.id,
                          counts: meal ? { [`${meal}_正`]: 1 } : {},
                          noSoup: dayOrder.noSoup || false
                        }, { merge: true });
                      }}
                      className="w-full text-xs border rounded p-1"
                    >
                      <option value="">唔訂</option>
                      <option value="A">A餐</option>
                      <option value="B">B餐</option>
                      <option value="C">C餐</option>
                    </select>
                    <button 
                      onClick={async () => {
                        await setDoc(doc(db, "orders", `${dateStr}_${customer.id}`), { noSoup: !dayOrder.noSoup }, { merge: true });
                      }}
                      className={`w-full text-[10px] p-1 rounded font-bold ${dayOrder.noSoup ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}
                    >
                      {dayOrder.noSoup ? '走湯' : '連湯'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (!isAuthenticated) return <div className="p-20 text-center">請登入</div>;

  return (
    <div className="flex min-h-screen bg-slate-100 font-sans">
      {/* 側邊欄 */}
      <aside className="w-64 bg-slate-900 text-white p-6 no-print fixed h-full">
        <div className="text-orange-500 font-black text-2xl mb-12 italic">WECARE</div>
        <nav className="space-y-4">
          <button onClick={() => setActiveTab('customers')} className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 ${activeTab === 'customers' ? 'bg-orange-500' : 'text-slate-400'}`}><Users size={20}/> 客戶資料管理</button>
          <button onClick={() => setActiveTab('batch')} className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 ${activeTab === 'batch' ? 'bg-orange-500' : 'text-slate-400'}`}><ClipboardList size={20}/> 今日出車表</button>
          <button onClick={() => setActiveTab('import')} className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 ${activeTab === 'import' ? 'bg-orange-500' : 'text-slate-400'}`}><Upload size={20}/> 批量導入</button>
          <div className="pt-8 border-t border-slate-700">
            <button onClick={exportKitchenExcel} className="w-full bg-emerald-600 text-white p-3 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-lg"><FileSpreadsheet size={18}/> 導出廚房 Excel</button>
          </div>
        </nav>
      </aside>

      {/* 主內容 */}
      <main className="flex-1 ml-64 p-10">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">{activeTab}</h2>
          <div className="flex gap-4 items-center">
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="p-3 rounded-2xl border shadow-sm font-bold" />
          </div>
        </div>

        {activeTab === 'customers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customers.map(c => (
              <div key={c.id} className="bg-white p-6 rounded-3xl shadow-sm border hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded text-slate-500 uppercase">{c.zone}</span>
                    <h3 className="text-xl font-bold mt-1">{c.name}</h3>
                  </div>
                  <button onClick={() => setSelectedCustomer(c)} className="p-2 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100"><CalendarIcon size={20}/></button>
                </div>
                <p className="text-xs text-slate-400 mb-4 h-8 line-clamp-2">{c.address}</p>
                <div className="flex gap-2">
                  <button className="flex-1 text-xs py-2 border rounded-xl hover:bg-slate-50">編輯資料</button>
                  <button onClick={() => setSelectedCustomer(c)} className="flex-1 text-xs py-2 bg-slate-900 text-white rounded-xl font-bold">查看月曆</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'import' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="bg-white p-12 rounded-[40px] shadow-xl text-center border-2 border-dashed">
              <Upload className="mx-auto text-orange-500 mb-6" size={48}/>
              <h3 className="text-xl font-bold mb-2">全月訂單批量導入</h3>
              <p className="text-sm text-slate-400 mb-8">一行一客，橫向 1-31 號 (代碼: A, B, C, A-走湯)</p>
              <input type="file" onChange={handleMassImport} className="text-xs" />
            </div>
          </div>
        )}

        {activeTab === 'batch' && (
          <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
             {/* 這裡顯示當日的派送清單，可以按線路分組 */}
             <table className="w-full">
               <thead className="bg-slate-50 border-b">
                 <tr>
                   <th className="p-4 text-left">客戶</th>
                   <th className="p-4 text-center">餐類</th>
                   <th className="p-4 text-center">湯</th>
                   <th className="p-4 text-left">備註</th>
                 </tr>
               </thead>
               <tbody>
                 {orders.map(o => {
                   const c = customers.find(cust => cust.id === o.customerId);
                   if(!c) return null;
                   const mealKey = Object.keys(o.counts || {}).find(k => o.counts[k] > 0);
                   if(!mealKey) return null;
                   return (
                     <tr key={o.customerId} className="border-b">
                       <td className="p-4">
                         <div className="font-bold">{c.name}</div>
                         <div className="text-[10px] text-slate-400">{c.zone}</div>
                       </td>
                       <td className="p-4 text-center">
                         <span className="font-black text-orange-600">{mealKey.split('_')[0]}</span>
                         <span className="text-[10px] ml-1">({mealKey.split('_')[1]})</span>
                       </td>
                       <td className="p-4 text-center">
                         {o.noSoup ? <span className="text-red-500 font-bold">走湯</span> : <Soup className="mx-auto text-emerald-500" size={18}/>}
                       </td>
                       <td className="p-4 text-xs text-slate-500">{o.notes || c.requirement}</td>
                     </tr>
                   )
                 })}
               </tbody>
             </table>
          </div>
        )}

        {selectedCustomer && <CustomerCalendar customer={selectedCustomer} />}
      </main>
    </div>
  );
}
