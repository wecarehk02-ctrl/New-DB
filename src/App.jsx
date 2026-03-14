import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, ClipboardList, Printer, FileSpreadsheet, ChefHat, 
  Upload, Search, Plus, Download, Edit2, Check, X, Calendar as CalendarIcon, 
  Soup, ArrowLeft, ArrowRight, Trash2, MapPin, Building2, BarChart3, Copy, Hash
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, doc, setDoc, query, where, getDocs, deleteDoc 
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';

// --- Firebase 初始化 ---
// 請確保你的環境變數已正確設置 __firebase_config
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'wecare-production';

// --- 常量定義 ---
const TEXTURES = ['正', '碎', '免治', '分糊', '全糊'];
const MEALS = ['A', 'B', 'C'];
const ZONES = ['沙田及北區線', '葵青荃灣線', '觀塘線', '屯元天線', '土瓜環步兵', '團體線'];
const CUST_TYPES = ['普通個人', 'CCSV 客戶', '團體單'];

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('customers'); 
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // 數據狀態
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menus, setMenus] = useState({});

  // UI 狀態
  const [selectedCustomer, setSelectedCustomer] = useState(null); 
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); 
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [newCust, setNewCust] = useState({ id: '', name: '', address: '', phone: '', zone: ZONES[0], type: CUST_TYPES[0], institution: '', requirement: '' });

  // --- 認證 ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // --- 數據監聽 ---
  useEffect(() => {
    if (!user) return;

    // 監聽客戶
    const unsubCust = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'customers'),
      (snap) => {
        const data = snap.docs.map(d => d.data());
        setCustomers(data.sort((a,b) => String(a.id).localeCompare(String(b.id))));
      },
      (err) => console.error("Firestore Error:", err)
    );

    // 監聽餐單
    const unsubMenu = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'menus'),
      (snap) => {
        const mObj = {};
        snap.docs.forEach(d => mObj[d.id] = d.data());
        setMenus(mObj);
      }
    );

    // 監聽當日訂單
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'orders'),
      where("date", "==", selectedDate)
    );
    const unsubOrders = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => d.data()));
    });

    return () => {
      unsubCust();
      unsubMenu();
      unsubOrders();
    };
  }, [user, selectedDate]);

  // --- 批量導入邏輯 (Excel) ---
  const handleCustImport = async (e) => {
    const file = e.target.files[0];
    if (!file || !window.XLSX) return alert("請確保已載入 XLSX 庫");
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = window.XLSX.read(evt.target.result, { type: 'binary' });
      const data = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      
      for (let row of data) {
        const id = String(row.ID || row.id);
        if (id) {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'customers', id), {
            id, name: row.姓名 || "", address: row.地址 || "", phone: row.電話 || "", 
            zone: row.線路 || ZONES[0], type: row.類別 || CUST_TYPES[0], 
            institution: row.機構 || "", requirement: row.特別要求 || ""
          });
        }
      }
      alert("客戶資料導入成功！");
    };
    reader.readAsBinaryString(file);
  };

  const handleMenuImport = async (e) => {
    const file = e.target.files[0];
    if (!file || !window.XLSX) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = window.XLSX.read(evt.target.result, { type: 'binary' });
      const data = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      
      for (let row of data) {
        const match = row["日期"]?.match(/(\d+)月(\d+)日/);
        if (match) {
          const dateStr = `2026-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'menus', dateStr), {
            A: row["(A餐)款式"] || "", B: row["(B餐)款式"] || "", C: row["(C餐)款式"] || "", Soup: row["(例湯)"] || ""
          });
        }
      }
      alert("餐單導入成功！");
    };
    reader.readAsBinaryString(file);
  };

  const handleMassImportOrders = async (e) => {
    const file = e.target.files[0];
    if (!file || !window.XLSX) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = window.XLSX.read(evt.target.result, { type: 'binary' });
      const data = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      
      for (let row of data) {
        const custId = String(row["客戶ID"] || row["ID"]);
        const texture = row["規格"] || "正";
        for (let day = 1; day <= 31; day++) {
          const val = row[`${day}號`]?.toString().toUpperCase();
          if (!val) continue;
          const dateStr = `${monthPrefix}-${String(day).padStart(2, '0')}`;
          
          const qtyMatch = val.match(/(\d+)?([ABC])(-)?/);
          if (qtyMatch) {
            const qty = parseInt(qtyMatch[1]) || 1;
            const meal = qtyMatch[2];
            const skipSoup = qtyMatch[3] !== undefined;
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', `${dateStr}_${custId}`), {
              date: dateStr, customerId: custId, counts: { [`${meal}_${texture}`]: qty }, noSoup: skipSoup
            }, { merge: true });
          }
        }
      }
      alert("批量訂單導入完成！");
    };
    reader.readAsBinaryString(file);
  };

  // --- 對數報表統計 ---
  const reconciliationData = useMemo(() => {
    const report = {};
    orders.forEach(o => {
      const cust = customers.find(c => c.id === o.customerId);
      if (!cust) return;
      const groupKey = cust.institution || "獨立個人客戶";
      if (!report[groupKey]) {
        report[groupKey] = { name: groupKey, type: cust.type, A: 0, B: 0, C: 0, Soup: 0, total: 0 };
      }
      
      Object.keys(o.counts || {}).forEach(k => {
        const [meal] = k.split('_');
        const qty = o.counts[k] || 0;
        if (meal === 'A') report[groupKey].A += qty;
        if (meal === 'B') report[groupKey].B += qty;
        if (meal === 'C') report[groupKey].C += qty;
        report[groupKey].total += qty;
      });
      if (!o.noSoup) report[groupKey].Soup += 1;
    });
    return Object.values(report);
  }, [orders, customers]);

  // --- 數字輸入點餐月曆組件 ---
  const CustomerCalendar = ({ customer }) => {
    const [monthOrders, setMonthOrders] = useState([]);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    useEffect(() => {
      const fetchMonthData = async () => {
        const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const q = query(
          collection(db, 'artifacts', appId, 'public', 'data', 'orders'),
          where("customerId", "==", customer.id)
        );
        const s = await getDocs(q);
        setMonthOrders(s.docs.map(d => d.data()).filter(o => o.date.startsWith(prefix)));
      };
      fetchMonthData();
    }, [customer.id, currentMonth]);

    const updateQty = async (dateStr, meal, texture, val) => {
      const qty = Math.max(0, parseInt(val) || 0);
      const orderId = `${dateStr}_${customer.id}`;
      const existing = monthOrders.find(o => o.date === dateStr) || { counts: {}, noSoup: false };
      const newOrder = {
        ...existing,
        date: dateStr,
        customerId: customer.id,
        counts: { ...existing.counts, [`${meal}_${texture}`]: qty }
      };
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId), newOrder, { merge: true });
      setMonthOrders(prev => [...prev.filter(o => o.date !== dateStr), newOrder]);
    };

    return (
      <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl">
          <div className="p-8 border-b flex justify-between items-center bg-slate-50">
            <div>
              <h3 className="text-3xl font-black text-slate-800">{customer.name} - 點餐明細</h3>
              <p className="text-xs text-slate-400 font-bold uppercase mt-1">
                {currentYear}年 {currentMonth + 1}月 | 機構: {customer.institution || '獨立個人'}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCurrentMonth(m => m === 0 ? 11 : m - 1)} className="p-3 border rounded-xl hover:bg-white"><ArrowLeft/></button>
              <button onClick={() => setCurrentMonth(m => m === 11 ? 0 : m + 1)} className="p-3 border rounded-xl hover:bg-white"><ArrowRight/></button>
              <button onClick={() => setSelectedCustomer(null)} className="ml-4 p-3 bg-slate-900 text-white rounded-xl hover:bg-red-500 transition-all"><X/></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-8 bg-slate-100/30">
            <div className="grid grid-cols-7 gap-4">
              {['日','一','二','三','四','五','六'].map(d => (
                <div key={d} className="text-center text-[10px] font-black text-slate-300 uppercase py-2 tracking-widest">{d}</div>
              ))}
              {[...Array(new Date(currentYear, currentMonth, 1).getDay())].map((_, i) => <div key={`empty-${i}`} />)}
              {[...Array(daysInMonth)].map((_, i) => {
                const day = i + 1;
                const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const order = monthOrders.find(o => o.date === dateStr) || { counts: {}, noSoup: false };
                const dayMenu = menus[dateStr] || { A: '', B: '', C: '', Soup: '' };
                const total = Object.values(order.counts || {}).reduce((a, b) => a + b, 0);

                return (
                  <div key={day} className={`border rounded-[2rem] p-4 flex flex-col gap-3 min-h-[220px] transition-all ${total > 0 ? 'bg-white border-orange-200 shadow-lg' : 'bg-slate-50/50 opacity-60 hover:opacity-100'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-black text-slate-400">{day}</span>
                      <button 
                        onClick={async () => {
                          const newNoSoup = !order.noSoup;
                          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', `${dateStr}_${customer.id}`), { noSoup: newNoSoup }, { merge: true });
                          setMonthOrders(prev => prev.map(o => o.date === dateStr ? {...o, noSoup: newNoSoup} : o));
                        }}
                        className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${order.noSoup ? 'bg-red-500 text-white' : 'bg-emerald-100 text-emerald-600'}`}
                      >
                        {order.noSoup ? '走湯' : '連湯'}
                      </button>
                    </div>
                    <div className="space-y-4 flex-1">
                      {MEALS.map(m => (
                        <div key={m} className="space-y-1">
                          <div className="text-[9px] font-black text-orange-500 line-clamp-1">{m}: {dayMenu[m] || '未設定菜名'}</div>
                          <div className="grid grid-cols-3 gap-1">
                            {TEXTURES.map(t => (
                              <div key={t} className="flex flex-col items-center">
                                <span className="text-[7px] text-slate-300 font-bold mb-0.5">{t}</span>
                                <input 
                                  type="number" 
                                  min="0"
                                  value={order.counts[`${m}_${t}`] || ''}
                                  onChange={(e) => updateQty(dateStr, m, t, e.target.value)}
                                  className="w-full bg-slate-100 rounded p-1 text-[10px] font-black text-center outline-none focus:ring-1 focus:ring-orange-500"
                                  placeholder="0"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
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
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* 側邊欄 */}
      <aside className="w-72 bg-slate-900 text-white p-8 no-print fixed h-full z-20 shadow-2xl flex flex-col">
        <div className="flex items-center gap-4 mb-16">
          <div className="w-16 h-16 bg-white rounded-2xl p-1 overflow-hidden flex items-center justify-center shadow-inner">
            <img src="/logo.png" alt="WeCare Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-black italic text-orange-500 tracking-tighter leading-none">WECARE</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Ops Engine</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <button onClick={() => setActiveTab('customers')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'customers' ? 'bg-orange-500 shadow-lg shadow-orange-500/20 font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Users size={20}/> 客戶資料管理</button>
          <button onClick={() => setActiveTab('add')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'add' ? 'bg-orange-500 shadow-lg shadow-orange-500/20 font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Plus size={20}/> 新增客戶 (批量導入)</button>
          <button onClick={() => setActiveTab('menu')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'menu' ? 'bg-orange-500 shadow-lg shadow-orange-500/20 font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><ChefHat size={20}/> 每月餐單 (批量導入)</button>
          <button onClick={() => setActiveTab('stickers')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'stickers' ? 'bg-orange-500 shadow-lg shadow-orange-500/20 font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Printer size={20}/> 列印出餐貼紙</button>
          <button onClick={() => setActiveTab('recon')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'recon' ? 'bg-orange-500 shadow-lg shadow-orange-500/20 font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><BarChart3 size={20}/> 月度機構對數</button>
        </nav>
      </aside>

      {/* 主介面 */}
      <main className="flex-1 ml-72 p-12 h-screen overflow-y-auto">
        <header className="flex justify-between items-end mb-12 no-print">
          <div>
            <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter">{activeTab}</h2>
            <div className="h-1.5 w-24 bg-orange-500 rounded-full mt-4"></div>
          </div>
          <div className="bg-white p-2 rounded-2xl shadow-sm border flex items-center gap-2">
            <CalendarIcon size={18} className="ml-3 text-slate-400"/>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="p-3 font-black outline-none bg-transparent cursor-pointer" />
          </div>
        </header>

        {activeTab === 'customers' && (
          <div className="space-y-8">
            <div className="relative max-w-xl">
              <Search className="absolute left-6 top-6 text-slate-300" size={20} />
              <input 
                placeholder="搜尋姓名、地址、編號或機構..." 
                className="w-full pl-16 pr-8 py-6 rounded-[2rem] shadow-sm border-none outline-none focus:ring-4 focus:ring-orange-500/10 font-bold text-lg transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {customers.filter(c => c.name.includes(searchTerm) || c.institution.includes(searchTerm)).map(c => (
                <div key={c.id} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group flex flex-col h-full">
                  <div className="flex justify-between items-start mb-6">
                    <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${c.type === 'CCSV 客戶' ? 'bg-blue-50 text-blue-500' : c.type === '團體單' ? 'bg-orange-50 text-orange-500' : 'bg-slate-100 text-slate-400'}`}>{c.type}</span>
                    <button onClick={() => setSelectedCustomer(c)} className="p-3 bg-orange-50 text-orange-500 rounded-2xl group-hover:bg-orange-500 group-hover:text-white transition-all"><CalendarIcon size={20}/></button>
                  </div>
                  <h4 className="text-2xl font-black text-slate-800 leading-tight">{c.name}</h4>
                  <div className="mt-2 flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest"><Building2 size={12}/> {c.institution || "獨立個人"}</div>
                  <p className="text-xs text-slate-400 mt-6 leading-relaxed grow line-clamp-2"><MapPin size={12} className="inline mr-2"/>{c.address}</p>
                  <button onClick={() => setSelectedCustomer(c)} className="mt-8 py-4 bg-slate-900 text-white rounded-3xl font-black text-xs hover:bg-orange-600 transition-all shadow-xl active:scale-95">進入點餐管理</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'add' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white p-16 rounded-[4rem] shadow-sm border-4 border-dashed border-slate-100 flex flex-col items-center text-center">
              <Upload size={56} className="text-orange-500 mb-8" />
              <h3 className="text-2xl font-black mb-4">全月訂單批量導入 (Excel)</h3>
              <p className="text-sm text-slate-400 mb-10 max-w-md font-bold uppercase tracking-widest italic leading-relaxed">支援「25A」或「15B-」格式。橫向填寫 1-31 號之點餐數量及類別。</p>
              <label className="bg-orange-500 text-white px-12 py-5 rounded-3xl font-black text-lg cursor-pointer hover:bg-orange-600 transition-all shadow-xl active:scale-95">
                選擇檔案導入
                <input type="file" onChange={handleMassImportOrders} className="hidden" />
              </label>
            </div>
            <div className="bg-white p-16 rounded-[4rem] shadow-sm border-4 border-dashed border-slate-100 flex flex-col items-center text-center">
              <Users size={56} className="text-blue-500 mb-8" />
              <h3 className="text-2xl font-black mb-4">批量導入客戶基本資料表</h3>
              <label className="bg-blue-600 text-white px-12 py-5 rounded-3xl font-black text-lg cursor-pointer hover:bg-blue-700 transition-all shadow-xl active:scale-95">
                選擇客戶表導入
                <input type="file" onChange={handleCustImport} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white p-16 rounded-[4rem] shadow-sm border-4 border-dashed border-slate-100 flex flex-col items-center text-center">
              <ChefHat size={56} className="text-emerald-500 mb-8" />
              <h3 className="text-2xl font-black mb-4">批量導入每月餐單內容</h3>
              <p className="text-sm text-slate-400 mb-10 max-w-md font-bold tracking-widest uppercase">格式：日期（4月1日）、(A餐)款式、(B餐)款式、(C餐)款式、(例湯)</p>
              <label className="bg-emerald-600 text-white px-12 py-5 rounded-3xl font-black text-lg cursor-pointer hover:bg-emerald-700 transition-all shadow-xl active:scale-95">
                選擇餐單導入
                <input type="file" onChange={handleMenuImport} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {activeTab === 'stickers' && (
          <div className="space-y-8 no-print">
             <div className="bg-orange-50 p-6 rounded-[2rem] border border-orange-100 flex items-center justify-between">
                <div>
                  <h4 className="font-black text-orange-800">準備打印出餐標籤</h4>
                  <p className="text-xs text-orange-600 font-bold uppercase mt-1">當日有訂單的客戶: {orders.filter(o => Object.values(o.counts || {}).reduce((a, b) => a + b, 0) > 0).length} 位</p>
                </div>
                <button onClick={() => window.print()} className="bg-orange-500 text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-orange-500/30">列印所有標籤</button>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                {orders.map(o => {
                  const c = customers.find(cust => cust.id === o.customerId);
                  if(!c) return null;
                  const totalCounts = Object.values(o.counts || {}).reduce((a, b) => a + b, 0);
                  if(totalCounts === 0) return null;

                  return (
                    <div key={o.customerId} className="bg-white border-2 border-black p-6 h-[320px] relative flex flex-col font-bold">
                       <div className="text-center border-b-2 border-black pb-2 mb-2">
                         <div className="text-3xl font-black tracking-tighter uppercase">{c.name}</div>
                         <div className="text-[10px] uppercase">{c.zone}</div>
                       </div>
                       <div className="text-xs mb-4 h-10 overflow-hidden">{c.address}</div>
                       <div className="flex-1 space-y-1">
                          {Object.keys(o.counts || {}).map(k => o.counts[k] > 0 && (
                            <div key={k} className="flex justify-between border-b border-black/10 py-1">
                              <span>({k.split('_')[0]}餐-{k.split('_')[1]}) {(menus[selectedDate] || {})[k.split('_')[0]]}</span>
                              <span className="font-black text-lg">x {o.counts[k]}</span>
                            </div>
                          ))}
                          {!o.noSoup && (
                             <div className="flex justify-between py-1 border-b border-black/10">
                               <span>今日例湯: {(menus[selectedDate] || {}).Soup}</span>
                               <span className="font-black text-lg">x {totalCounts}</span>
                             </div>
                          )}
                       </div>
                       <div className="text-[10px] text-red-600 italic mt-2">{c.requirement || "無備註"}</div>
                    </div>
                  );
                })}
             </div>
          </div>
        )}

        {activeTab === 'recon' && (
          <div className="bg-white rounded-[3rem] shadow-sm border overflow-hidden">
            <div className="p-10 border-b flex justify-between items-center bg-slate-50/50">
               <div>
                 <h3 className="font-black text-2xl tracking-tighter">機構對數月度彙報</h3>
                 <p className="text-[10px] text-slate-400 font-black uppercase mt-2 tracking-widest">目前日期：{selectedDate}</p>
               </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-slate-400 text-[10px] uppercase font-black tracking-widest">
                  <th className="p-8 text-left">對數機構名稱</th>
                  <th className="p-8 text-center">類別</th>
                  <th className="p-8 text-center">A餐總量</th>
                  <th className="p-8 text-center">B餐總量</th>
                  <th className="p-8 text-center">C餐總量</th>
                  <th className="p-8 text-center">例湯總數</th>
                  <th className="p-8 text-right">當日總量</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold">
                {reconciliationData.map(r => (
                  <tr key={r.name} className="hover:bg-slate-50/50 transition-colors font-bold">
                    <td className="p-8 text-lg font-black text-slate-800">{r.name}</td>
                    <td className="p-8 text-center"><span className="px-3 py-1 bg-slate-100 text-[9px] font-black rounded-full text-slate-400">{r.type}</span></td>
                    <td className="p-8 text-center text-orange-600">{r.A}</td>
                    <td className="p-8 text-center text-blue-600">{r.B}</td>
                    <td className="p-8 text-center text-emerald-600">{r.C}</td>
                    <td className="p-8 text-center text-slate-400">{r.Soup}</td>
                    <td className="p-8 text-right text-2xl font-black text-slate-900">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedCustomer && <CustomerCalendar customer={selectedCustomer} />}
      </main>
      
      <style>{`
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        @media print {
          .no-print { display: none !important; }
          main { margin-left: 0 !important; padding: 0 !important; background: white; }
          .grid { display: grid !important; grid-template-cols: 1fr 1fr !important; gap: 10px !important; }
        }
      `}</style>
    </div>
  );
}
