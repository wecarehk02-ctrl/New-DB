import React, { useState, useEffect } from 'react';
import { 
  Users, ClipboardList, Printer, FileSpreadsheet, ChefHat, 
  Upload, Search, Plus, Download, Edit2, Check, X, Calendar as CalendarIcon, Soup, ArrowLeft, ArrowRight
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase'; 

// 常量定義
const TEXTURES = ['正', '碎', '免治', '分糊', '全糊'];
const MEALS = ['A', 'B', 'C'];
const ZONES = ['沙田及北區線', '葵青荃灣線', '觀塘線', '屯元天線', '土瓜環步兵', '團體線'];

export default function WeCareProSystem() {
  // --- 狀態管理 ---
  const [isAuthenticated, setIsAuthenticated] = useState(true); // 暫時設為 true 方便你直接睇介面
  const [activeTab, setActiveTab] = useState('customers'); 
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menuNames, setMenuNames] = useState({ A: '', B: '', C: '', Soup: '' });
  
  // 管理狀態
  const [selectedCustomer, setSelectedCustomer] = useState(null); 
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); 
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // 監聽 Firebase 數據
    const unsubCust = onSnapshot(collection(db, "customers"), (s) => {
      setCustomers(s.docs.map(d => d.data()).sort((a,b) => String(a.id).localeCompare(String(b.id))));
    });
    const unsubMenu = onSnapshot(doc(db, "menus", selectedDate), (d) => {
      setMenuNames(d.exists() ? d.data() : { A: '', B: '', C: '', Soup: '' });
    });
    const q = query(collection(db, "orders"), where("date", "==", selectedDate));
    const unsubOrders = onSnapshot(q, (s) => setOrders(s.docs.map(d => d.data())));

    return () => { unsubCust(); unsubMenu(); unsubOrders(); };
  }, [selectedDate]);

  // --- 橫向全月導入 ---
  const handleMassImport = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

      for (let row of data) {
        const custId = String(row["客戶ID"] || row["ID"]);
        const texture = row["規格"] || "正";

        for (let day = 1; day <= 31; day++) {
          const val = row[`${day}號`]?.toString().toUpperCase();
          if (!val) continue;

          const dateStr = `${monthPrefix}-${String(day).padStart(2, '0')}`;
          const mealType = val[0]; 
          const skipSoup = val.includes('-') || val.includes('走'); 

          await setDoc(doc(db, "orders", `${dateStr}_${custId}`), {
            date: dateStr,
            customerId: custId,
            counts: { [`${mealType}_${texture}`]: 1 },
            noSoup: skipSoup
          }, { merge: true });
        }
      }
      alert("全月訂單導入成功！");
    };
    reader.readAsBinaryString(file);
  };

  // --- 導出廚房報表 ---
  const exportKitchenExcel = () => {
    const report = [];
    TEXTURES.forEach(t => {
      const row = { "規格": t };
      MEALS.forEach(m => {
        const count = orders.reduce((sum, o) => sum + (o.counts?.[`${m}_${t}`] || 0), 0);
        row[`${m}餐`] = count;
      });
      report.push(row);
    });
    
    const totalSoup = orders.reduce((sum, o) => {
      const hasMeal = Object.values(o.counts || {}).some(v => v > 0);
      return sum + (hasMeal && !o.noSoup ? 1 : 0);
    }, 0);
    report.push({ "規格": "總計", "例湯總量": totalSoup });

    const ws = XLSX.utils.json_to_sheet(report);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "廚房清單");
    XLSX.writeFile(wb, `Kitchen_${selectedDate}.xlsx`);
  };

  // --- 客戶月曆組件 ---
  const CustomerCalendar = ({ customer }) => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const [monthOrders, setMonthOrders] = useState([]);

    useEffect(() => {
      const fetchOrders = async () => {
        const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const q = query(collection(db, "orders"), where("customerId", "==", customer.id));
        const s = await getDocs(q);
        setMonthOrders(s.docs.map(d => d.data()).filter(o => o.date.startsWith(prefix)));
      };
      fetchOrders();
    }, [customer.id, currentMonth]);

    return (
      <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-[2rem] w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
          <div className="p-8 border-b flex justify-between items-center bg-slate-50">
            <div>
              <h3 className="text-2xl font-black text-slate-800">{customer.name} <span className="text-slate-400 text-sm ml-2">#{customer.id}</span></h3>
              <p className="text-sm text-slate-500">{currentYear}年 {currentMonth + 1}月訂餐設定</p>
            </div>
            <div className="flex gap-2">
               <button onClick={() => setCurrentMonth(prev => prev === 0 ? 11 : prev - 1)} className="p-2 border rounded-xl hover:bg-white"><ArrowLeft size={20}/></button>
               <button onClick={() => setCurrentMonth(prev => prev === 11 ? 0 : prev + 1)} className="p-2 border rounded-xl hover:bg-white"><ArrowRight size={20}/></button>
               <button onClick={() => setSelectedCustomer(null)} className="p-2 bg-slate-200 rounded-xl ml-4 hover:bg-slate-300"><X/></button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-8">
            <div className="grid grid-cols-7 gap-4">
              {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-center text-xs font-bold text-slate-400 pb-2">{d}</div>)}
              {[...Array(daysInMonth)].map((_, i) => {
                const day = i + 1;
                const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const order = monthOrders.find(o => o.date === dateStr) || { counts: {}, noSoup: false };
                const activeMeal = Object.keys(order.counts || {}).find(k => order.counts[k] > 0)?.split('_')[0] || '';

                return (
                  <div key={day} className={`border rounded-2xl p-3 min-h-[110px] flex flex-col justify-between transition-all ${activeMeal ? 'border-orange-200 bg-orange-50/30' : 'bg-slate-50 border-transparent'}`}>
                    <span className="text-sm font-bold text-slate-400">{day}</span>
                    <div className="space-y-2">
                      <select 
                        value={activeMeal}
                        onChange={async (e) => {
                          const meal = e.target.value;
                          await setDoc(doc(db, "orders", `${dateStr}_${customer.id}`), {
                            date: dateStr, customerId: customer.id,
                            counts: meal ? { [`${meal}_正`]: 1 } : {},
                            noSoup: order.noSoup || false
                          }, { merge: true });
                          // 重新整理本地狀態
                          setMonthOrders(prev => [...prev.filter(o => o.date !== dateStr), { date: dateStr, counts: meal ? { [`${meal}_正`]: 1 } : {}, noSoup: order.noSoup }]);
                        }}
                        className="w-full text-xs font-bold bg-white border rounded-lg p-1 outline-none"
                      >
                        <option value="">無</option>
                        <option value="A">A餐</option>
                        <option value="B">B餐</option>
                        <option value="C">C餐</option>
                      </select>
                      <button 
                        onClick={async () => {
                          const newNoSoup = !order.noSoup;
                          await setDoc(doc(db, "orders", `${dateStr}_${customer.id}`), { noSoup: newNoSoup }, { merge: true });
                          setMonthOrders(prev => prev.map(o => o.date === dateStr ? {...o, noSoup: newNoSoup} : o));
                        }}
                        className={`w-full text-[10px] py-1 rounded-lg font-black uppercase ${order.noSoup ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}
                      >
                        {order.noSoup ? '走湯' : '連湯'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* 側邊欄 */}
      <aside className="w-64 bg-slate-900 text-white p-6 no-print fixed h-full z-10 shadow-xl">
        <div className="text-orange-500 font-black text-3xl mb-12 tracking-tighter italic">WECARE</div>
        <nav className="space-y-3">
          <button onClick={() => setActiveTab('customers')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-3 transition-all ${activeTab === 'customers' ? 'bg-orange-500 shadow-lg shadow-orange-500/30' : 'text-slate-400 hover:bg-slate-800'}`}><Users size={20}/> 客戶管理</button>
          <button onClick={() => setActiveTab('batch')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-3 transition-all ${activeTab === 'batch' ? 'bg-orange-500 shadow-lg shadow-orange-500/30' : 'text-slate-400 hover:bg-slate-800'}`}><ClipboardList size={20}/> 今日出車</button>
          <button onClick={() => setActiveTab('import')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-3 transition-all ${activeTab === 'import' ? 'bg-orange-500 shadow-lg shadow-orange-500/30' : 'text-slate-400 hover:bg-slate-800'}`}><Upload size={20}/> 批量導入</button>
          <div className="pt-10">
            <button onClick={exportKitchenExcel} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl flex items-center justify-center gap-2 font-black shadow-lg transition-all active:scale-95"><FileSpreadsheet size={20}/> 導出廚房表</button>
          </div>
        </nav>
      </aside>

      {/* 主介面 */}
      <main className="flex-1 ml-64 p-12">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tight">{activeTab}</h2>
            <p className="text-slate-400 font-medium">WeCare Operation Pro v2.0</p>
          </div>
          <div className="bg-white p-2 rounded-2xl shadow-sm border flex items-center gap-2">
            <CalendarIcon size={18} className="ml-2 text-slate-400"/>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="p-2 font-bold outline-none" />
          </div>
        </div>

        {activeTab === 'customers' && (
          <div className="space-y-8">
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-4 text-slate-300" size={20}/>
              <input 
                placeholder="搜尋姓名、地址或編號..." 
                className="w-full pl-12 pr-6 py-4 rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-orange-500 outline-none"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {customers.filter(c => c.name.includes(searchTerm) || c.id.includes(searchTerm)).map(c => (
                <div key={c.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl hover:border-orange-200 transition-all group">
                  <div className="flex justify-between items-start mb-6">
                    <div className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-500 uppercase">{c.zone}</div>
                    <button onClick={() => setSelectedCustomer(c)} className="p-3 bg-orange-50 text-orange-500 rounded-2xl group-hover:bg-orange-500 group-hover:text-white transition-all"><CalendarIcon size={20}/></button>
                  </div>
                  <h3 className="text-2xl font-black mb-1">{c.name}</h3>
                  <p className="text-xs text-slate-400 font-medium mb-6 h-8 line-clamp-2">{c.address}</p>
                  <button onClick={() => setSelectedCustomer(c)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-orange-500 transition-all shadow-lg">進入訂單月曆</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'import' && (
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
            <div className="bg-white p-12 rounded-[3rem] shadow-xl text-center border-2 border-dashed border-slate-200">
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 text-orange-500"><FileSpreadsheet size={32}/></div>
              <h3 className="text-xl font-black mb-2">全月訂單導入</h3>
              <p className="text-sm text-slate-400 mb-8 font-medium">格式：1號, 2號... (A, B, C, A走湯)</p>
              <input type="file" onChange={handleMassImport} className="text-xs file:bg-orange-500 file:text-white file:border-none file:px-6 file:py-2 file:rounded-full file:font-black cursor-pointer" />
            </div>
            {/* 其他導入功能 */}
          </div>
        )}

        {activeTab === 'batch' && (
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
             <table className="w-full">
               <thead className="bg-slate-50/50 border-b">
                 <tr>
                   <th className="p-6 text-left text-xs font-black text-slate-400 uppercase">派送對象</th>
                   <th className="p-6 text-center text-xs font-black text-slate-400 uppercase">餐類規格</th>
                   <th className="p-6 text-center text-xs font-black text-slate-400 uppercase">湯品狀態</th>
                   <th className="p-6 text-left text-xs font-black text-slate-400 uppercase">派送備註</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {orders.map(o => {
                   const c = customers.find(cust => cust.id === o.customerId);
                   if(!c) return null;
                   const mealKey = Object.keys(o.counts || {}).find(k => o.counts[k] > 0);
                   if(!mealKey) return null;
                   return (
                     <tr key={o.customerId} className="hover:bg-slate-50/50 transition-all">
                       <td className="p-6">
                         <div className="font-black text-lg">{c.name}</div>
                         <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{c.zone}</div>
                       </td>
                       <td className="p-6 text-center">
                         <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-4 py-2 rounded-xl">
                            <span className="font-black text-xl">{mealKey.split('_')[0]}</span>
                            <span className="text-[10px] font-bold uppercase">{mealKey.split('_')[1]}</span>
                         </div>
                       </td>
                       <td className="p-6 text-center">
                         {o.noSoup ? <span className="px-4 py-2 bg-red-100 text-red-600 rounded-xl font-black text-xs uppercase">走湯</span> : <div className="inline-flex items-center gap-2 text-emerald-600 font-black"><Soup size={20}/> <span>連湯</span></div>}
                       </td>
                       <td className="p-6 text-xs font-medium text-slate-400">{o.notes || c.requirement || '無'}</td>
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
