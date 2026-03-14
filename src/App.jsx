import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, ClipboardList, Printer, FileSpreadsheet, Save, Settings, 
  ChefHat, Download, Upload, Lock, History, Search, Calendar, ChevronRight
} from 'lucide-react';
import { 
  collection, onSnapshot, doc, setDoc, getDocs, query, where, orderBy, limit 
} from 'firebase/firestore';
import { auth, db } from './firebase'; 

export default function WeCareProSystem() {
  // --- 狀態管理 ---
  const [activeTab, setActiveTab] = useState('labels'); 
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menuNames, setMenuNames] = useState({ A: '', B: '', C: '', Soup: '' });
  const [historyOrders, setHistoryOrders] = useState([]);
  const [historySearchDate, setHistorySearchDate] = useState('');

  // --- 1. Firebase 即時監聽 ---
  useEffect(() => {
    // 監聽客戶資料 
    const unsubCust = onSnapshot(collection(db, "customers"), (snap) => {
      setCustomers(snap.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
    });

    // 監聽今日菜單 
    const unsubMenu = onSnapshot(doc(db, "menus", selectedDate), (d) => {
      if (d.exists()) setMenuNames(d.data());
      else setMenuNames({ A: '', B: '', C: '', Soup: '' });
    });

    // 監聽選定日期的所有訂單 
    const q = query(collection(db, "orders"), where("date", "==", selectedDate));
    const unsubOrders = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => d.data()));
    });

    return () => { unsubCust(); unsubMenu(); unsubOrders(); };
  }, [selectedDate]);

  // --- 2. 菜單與訂單處理邏輯 ---
  const handleUpdateMenu = async (field, value) => {
    const newMenu = { ...menuNames, [field]: value };
    setMenuNames(newMenu);
    await setDoc(doc(db, "menus", selectedDate), newMenu);
  };

  const handleUpdateOrder = async (customerId, field, value) => {
    const orderId = `${selectedDate}_${customerId}`;
    const existingOrder = orders.find(o => o.customerId === customerId) || {
      date: selectedDate, customerId, qtyA: 0, qtyB: 0, qtyC: 0, notes: ''
    };
    const newOrder = { ...existingOrder, [field]: value };
    await setDoc(doc(db, "orders", orderId), newOrder);
  };

  // --- 3. 報表匯出 (Excel)  ---
  const exportExcel = (type) => {
    let data = [];
    if (type === 'driver') {
      data = orders.map(o => {
        const c = customers.find(cust => cust.id === o.customerId);
        return { "線路": c?.zone, "姓名": c?.name, "電話": c?.phone, "地址": c?.address, "要求": o.notes || c?.requirement };
      });
    } else {
      const totals = { A: 0, B: 0, C: 0, Soup: 0 };
      orders.forEach(o => { totals.A += o.qtyA; totals.B += o.qtyB; totals.C += o.qtyC; });
      totals.Soup = totals.A + totals.B + totals.C;
      data = [{ "日期": selectedDate, ...totals }];
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `WeCare_${type}_${selectedDate}.xlsx`);
  };

  // --- 4. 過往紀錄查詢 (Subpage 邏輯) ---
  const fetchHistory = async () => {
    const q = query(
      collection(db, "orders"), 
      where("date", "==", historySearchDate || selectedDate),
      orderBy("customerId")
    );
    const snap = await getDocs(q);
    setHistoryOrders(snap.docs.map(d => d.data()));
  };

  // --- 5. 子頁面組件 ---
  
  // 標籤預覽頁 
  const LabelSection = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-orange-50 no-print">
        <h3 className="font-bold flex items-center gap-2 text-orange-600 mb-4"><ChefHat/> 今日菜單設定</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['A', 'B', 'C', 'Soup'].map(k => (
            <div key={k}>
              <label className="text-[10px] font-bold text-slate-400 uppercase">{k}</label>
              <input value={menuNames[k]} onChange={e => handleUpdateMenu(k, e.target.value)} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
        {orders.filter(o => o.qtyA+o.qtyB+o.qtyC > 0).map(o => {
          const c = customers.find(cust => cust.id === o.customerId);
          return (
            <div key={o.customerId} className="bg-white border-2 border-black p-6 h-[320px] relative flex flex-col print:m-0 break-inside-avoid">
              <div className="text-center border-b-2 border-black mb-2 pb-2">
                <div className="text-4xl font-bold">{c?.name}</div>
              </div>
              <div className="text-sm font-bold mb-4 h-12">{c?.address}</div>
              <div className="flex-1 space-y-1 font-bold">
                {o.qtyA > 0 && <div className="flex justify-between"><span>(A) {menuNames.A}</span><span>{o.qtyA}</span></div>}
                {o.qtyB > 0 && <div className="flex justify-between"><span>(B) {menuNames.B}</span><span>{o.qtyB}</span></div>}
                {o.qtyC > 0 && <div className="flex justify-between"><span>(C) {menuNames.C}</span><span>{o.qtyC}</span></div>}
                <div className="flex justify-between"><span>{menuNames.Soup}</span><span>1</span></div>
              </div>
              <div className="absolute bottom-4 right-4 w-14 h-14 rounded-full border-2 border-black flex items-center justify-center text-2xl font-black">{c?.texture?.charAt(0)}</div>
              <div className="absolute top-2 left-2 text-[10px] border border-black px-1 font-bold">{c?.zone}</div>
            </div>
          )
        })}
      </div>
    </div>
  );

  // 過往紀錄頁 (New Subpage)
  const HistorySection = () => (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-2xl shadow-sm border flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-400 mb-1">選擇日期查詢</label>
          <input type="date" value={historySearchDate} onChange={e => setHistorySearchDate(e.target.value)} className="w-full border rounded-xl p-3" />
        </div>
        <button onClick={fetchHistory} className="bg-slate-800 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-black">
          <Search size={18}/> 搜尋紀錄
        </button>
      </div>
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-4">客戶</th>
              <th className="px-6 py-4">日期</th>
              <th className="px-6 py-4 text-center">A/B/C</th>
              <th className="px-6 py-4">備註</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {historyOrders.length > 0 ? historyOrders.map(ho => {
              const c = customers.find(x => x.id === ho.customerId);
              return (
                <tr key={ho.customerId} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-bold">{c?.name}</td>
                  <td className="px-6 py-4 text-slate-500">{ho.date}</td>
                  <td className="px-6 py-4 text-center font-mono">{ho.qtyA}/{ho.qtyB}/{ho.qtyC}</td>
                  <td className="px-6 py-4 text-sm">{ho.notes}</td>
                </tr>
              )
            }) : (
              <tr><td colSpan="4" className="p-10 text-center text-slate-400">請選擇日期並點擊搜尋</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* 側邊欄 */}
      <nav className="w-64 bg-slate-900 text-white p-6 flex flex-col no-print">
        <div className="mb-10 text-orange-400 flex items-center gap-2 text-xl font-black italic">
          <ChefHat size={28}/> WECARE
        </div>
        <div className="space-y-2 flex-1">
          <button onClick={() => setActiveTab('batch')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'batch' ? 'bg-orange-500 shadow-lg shadow-orange-500/30' : 'hover:bg-slate-800 text-slate-400'}`}><ClipboardList size={20}/> 每日入單</button>
          <button onClick={() => setActiveTab('labels')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'labels' ? 'bg-orange-500 shadow-lg shadow-orange-500/30' : 'hover:bg-slate-800 text-slate-400'}`}><Printer size={20}/> 打印標籤</button>
          <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'history' ? 'bg-blue-600 shadow-lg shadow-blue-500/30' : 'hover:bg-slate-800 text-slate-400'}`}><History size={20}/> 過往紀錄</button>
          <button onClick={() => setActiveTab('customers')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'customers' ? 'bg-slate-700' : 'hover:bg-slate-800 text-slate-400'}`}><Users size={20}/> 客戶管理</button>
        </div>
        <div className="pt-6 border-t border-slate-800 space-y-2">
          <button onClick={() => exportExcel('driver')} className="w-full flex items-center gap-3 p-3 text-sm text-emerald-400 hover:bg-emerald-400/10 rounded-xl transition-all"><FileSpreadsheet size={18}/> 匯出司機表</button>
          <button onClick={() => exportExcel('kitchen')} className="w-full flex items-center gap-3 p-3 text-sm text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all"><FileSpreadsheet size={18}/> 匯出廚房表</button>
        </div>
      </nav>

      {/* 主內容區 */}
      <main className="flex-1 p-10 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <header className="flex justify-between items-center mb-10 no-print">
            <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight capitalize">{activeTab}</h2>
              <p className="text-slate-500 font-medium">WeCare Delivery Management System</p>
            </div>
            <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border">
              <Calendar size={20} className="text-slate-400 ml-2"/>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="font-bold outline-none text-slate-700" />
            </div>
          </header>

          {/* 分頁渲染 */}
          {activeTab === 'batch' && (
            <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
               <table className="w-full">
                 <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                   <tr><th className="px-8 py-5">客人與地址</th><th className="w-20 text-center">A</th><th className="w-20 text-center">B</th><th className="w-20 text-center">C</th><th className="px-8 py-5">備註</th></tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {customers.map(c => {
                     const order = orders.find(o => o.customerId === c.id) || {qtyA:0, qtyB:0, qtyC:0, notes:''};
                     return (
                       <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                         <td className="px-8 py-5">
                            <div className="font-bold text-slate-800">{c.name} <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-full text-slate-500 ml-2">{c.zone}</span></div>
                            <div className="text-xs text-slate-400 mt-1">{c.address}</div>
                         </td>
                         {['qtyA', 'qtyB', 'qtyC'].map(f => (
                           <td key={f} className="px-2"><input type="number" value={order[f] || ''} onChange={e => handleUpdateOrder(c.id, f, parseInt(e.target.value)||0)} className="w-full border-none bg-slate-50 rounded-lg p-2 text-center font-bold focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all" /></td>
                         ))}
                         <td className="px-8 py-5"><input value={order.notes} onChange={e => handleUpdateOrder(c.id, 'notes', e.target.value)} className="w-full border-none bg-slate-50 rounded-lg p-2 text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all" placeholder="輸入特別要求..." /></td>
                       </tr>
                     )
                   })}
                 </tbody>
               </table>
            </div>
          )}
          {activeTab === 'labels' && <LabelSection />}
          {activeTab === 'history' && <HistorySection />}
          {activeTab === 'customers' && (
            <div className="bg-white p-10 rounded-3xl border shadow-sm text-center text-slate-400">
               <Users size={48} className="mx-auto mb-4 opacity-20"/>
               客戶管理功能已就緒，可根據需求在此加入新增/刪除客人功能。
            </div>
          )}
        </div>
      </main>
      
      {/* 打印全局樣式 */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; }
          .max-w-6xl { max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
}
