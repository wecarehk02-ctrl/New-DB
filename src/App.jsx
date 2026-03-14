import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, ClipboardList, Printer, FileSpreadsheet, ChefHat, 
  Upload, Search, Plus, Download, Edit2, Check, X, Calendar as CalendarIcon, 
  Soup, ArrowLeft, ArrowRight, Trash2, MapPin, Phone, Building2, BarChart3, Copy, Save, Hash
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, query, where, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { signInWithEmailAndPassword, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// --- Firebase 配置 ---
const firebaseConfig = JSON.parse(__firebase_config);
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

  // --- Auth 認證 ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithEmailAndPassword(auth, __initial_auth_token).catch(() => signInAnonymously(auth));
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    onAuthStateChanged(auth, setUser);
  }, []);

  // --- 實時數據監聽 ---
  useEffect(() => {
    if (!user) return;
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'customers'), (snap) => {
      setCustomers(snap.docs.map(d => d.data()).sort((a,b) => String(a.id).localeCompare(String(b.id))));
    });
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'menus'), (snap) => {
      const mObj = {};
      snap.docs.forEach(d => mObj[d.id] = d.data());
      setMenus(mObj);
    });
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), where("date", "==", selectedDate));
    onSnapshot(q, (snap) => setOrders(snap.docs.map(d => d.data())));
  }, [user, selectedDate]);

  // --- 批量導入菜單 ---
  const handleMenuImport = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      for (let row of data) {
        const match = row["日期"]?.match(/(\d+)月(\d+)日/);
        if (match) {
          const dateStr = `2026-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'menus', dateStr), {
            A: row["(A餐)款式"] || "", B: row["(B餐)款式"] || "", C: row["(C餐)款式"] || "", Soup: row["(例湯)"] || ""
          });
        }
      }
      alert("餐單導入成功");
    };
    reader.readAsBinaryString(file);
  };

  // --- 批量導入客戶 ---
  const handleCustImport = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      for (let row of data) {
        const id = String(row.ID || row.id);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'customers', id), {
          id, name: row.姓名 || "", address: row.地址 || "", phone: row.電話 || "", zone: row.線路 || ZONES[0],
          type: row.類別 || CUST_TYPES[0], institution: row.機構 || "", requirement: row.特別要求 || ""
        });
      }
      alert("客戶名單導入成功");
    };
    reader.readAsBinaryString(file);
  };

  // --- 對數報表計算 ---
  const reconciliationData = useMemo(() => {
    const report = {};
    orders.forEach(o => {
      const cust = customers.find(c => c.id === o.customerId);
      if (!cust) return;
      const key = cust.institution || "獨立個人";
      if (!report[key]) report[key] = { name: key, type: cust.type, A: 0, B: 0, C: 0, Soup: 0, total: 0 };
      Object.keys(o.counts || {}).forEach(k => {
        const meal = k.split('_')[0];
        const qty = o.counts[k] || 0;
        report[key][meal] += qty;
        report[key].total += qty;
      });
      if (!o.noSoup) report[key].Soup += 1;
    });
    return Object.values(report);
  }, [orders, customers]);

  // --- 數字輸入月曆 ---
  const CustomerCalendar = ({ customer }) => {
    const [monthOrders, setMonthOrders] = useState([]);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    useEffect(() => {
      const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), where("customerId", "==", customer.id));
      getDocs(q).then(s => setMonthOrders(s.docs.map(d => d.data()).filter(o => o.date.startsWith(prefix))));
    }, [customer.id, currentMonth]);

    const updateQty = async (dateStr, meal, texture, val) => {
      const qty = Math.max(0, parseInt(val) || 0);
      const orderId = `${dateStr}_${customer.id}`;
      const existing = monthOrders.find(o => o.date === dateStr) || { counts: {}, noSoup: false };
      const newOrder = { ...existing, date: dateStr, customerId: customer.id, counts: { ...existing.counts, [`${meal}_${texture}`]: qty } };
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId), newOrder, { merge: true });
      setMonthOrders(prev => [...prev.filter(o => o.date !== dateStr), newOrder]);
    };

    return (
      <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
          <div className="p-8 border-b flex justify-between items-center bg-slate-50">
            <div>
              <h3 className="text-3xl font-black">{customer.name} - 訂單月曆</h3>
              <p className="text-xs text-slate-400 font-bold uppercase mt-1">{currentYear}年 {currentMonth + 1}月 | 機構: {customer.institution || '無'}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCurrentMonth(m => m === 0 ? 11 : m - 1)} className="p-3 border rounded-xl hover:bg-white"><ArrowLeft/></button>
              <button onClick={() => setCurrentMonth(m => m === 11 ? 0 : m + 1)} className="p-3 border rounded-xl hover:bg-white"><ArrowRight/></button>
              <button onClick={() => setSelectedCustomer(null)} className="ml-4 p-3 bg-slate-900 text-white rounded-xl hover:bg-red-500 transition-all"><X/></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-8 bg-slate-100/30">
            <div className="grid grid-cols-7 gap-4">
              {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-center text-[10px] font-black text-slate-300 uppercase py-2 tracking-widest">{d}</div>)}
              {[...Array(new Date(currentYear, currentMonth, 1).getDay())].map((_, i) => <div key={`empty-${i}`} />)}
              {[...Array(daysInMonth)].map((_, i) => {
                const day = i + 1;
                const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const order = monthOrders.find(o => o.date === dateStr) || { counts: {}, noSoup: false };
                const dayMenu = menus[dateStr] || { A: '', B: '', C: '', Soup: '' };
                const total = Object.values(order.counts || {}).reduce((a, b) => a + b, 0);

                return (
                  <div key={day} className={`border rounded-[2rem] p-4 flex flex-col gap-3 min-h-[220px] transition-all ${total > 0 ? 'bg-white border-orange-200 shadow-lg' : 'bg-slate-50/50 grayscale opacity-60'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-black text-slate-400">{day}</span>
                      <button onClick={async () => {
                        const newNoSoup = !order.noSoup;
                        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', `${dateStr}_${customer.id}`), { noSoup: newNoSoup }, { merge: true });
                        setMonthOrders(prev => prev.map(o => o.date === dateStr ? {...o, noSoup: newNoSoup} : o));
                      }} className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${order.noSoup ? 'bg-red-500 text-white' : 'bg-emerald-100 text-emerald-600'}`}>{order.noSoup ? '走湯' : '連湯'}</button>
                    </div>
                    <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                      {MEALS.map(m => (
                        <div key={m} className="space-y-1">
                          <div className="text-[9px] font-black text-orange-500 truncate">{m}: {dayMenu[m]}</div>
                          <div className="grid grid-cols-3 gap-1">
                            {TEXTURES.map(t => (
                              <div key={t} className="flex flex-col">
                                <span className="text-[7px] text-slate-300 font-bold text-center">{t}</span>
                                <input type="number" min="0" value={order.counts[`${m}_${t}`] || ''} onChange={(e) => updateQty(dateStr, m, t, e.target.value)} className="w-full bg-slate-100 rounded p-1 text-[10px] font-black text-center outline-none focus:ring-1 focus:ring-orange-500" placeholder="0" />
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
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 text-white p-8 no-print fixed h-full z-20 shadow-2xl">
        <div className="flex items-center gap-4 mb-16">
          <div className="w-16 h-16 bg-white rounded-2xl p-1 overflow-hidden flex items-center justify-center">
            <img src="Logo for WeCare Community Service - Uplifting Symb.png" className="w-full h-full object-contain" />
          </div>
          <div><h1 className="text-2xl font-black italic text-orange-500 tracking-tighter">WECARE</h1><p className="text-[10px] text-slate-500 font-bold uppercase mt-2">Ops Engine</p></div>
        </div>
        <nav className="space-y-2">
          <button onClick={() => setActiveTab('customers')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'customers' ? 'bg-orange-500 shadow-lg shadow-orange-500/20 font-bold' : 'text-slate-400 hover:bg-slate-800'}`}><Users size={20}/> 客戶資料管理</button>
          <button onClick={() => setActiveTab('add')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'add' ? 'bg-orange-500 font-bold shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:bg-slate-800'}`}><Plus size={20}/> 新增客戶/全月導入</button>
          <button onClick={() => setActiveTab('menu')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'menu' ? 'bg-orange-500 font-bold shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:bg-slate-800'}`}><ChefHat size={20}/> 每月餐單</button>
          <button onClick={() => setActiveTab('stickers')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'stickers' ? 'bg-orange-500 font-bold shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:bg-slate-800'}`}><Printer size={20}/> 列印出餐貼紙</button>
          <button onClick={() => setActiveTab('recon')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'recon' ? 'bg-orange-500 font-bold shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:bg-slate-800'}`}><BarChart3 size={20}/> 月度機構對數</button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-72 p-12 h-screen overflow-y-auto">
        <header className="flex justify-between items-end mb-12">
          <div><h2 className="text-5xl font-black text-slate-800 uppercase tracking-tighter">{activeTab}</h2><div className="h-1.5 w-24 bg-orange-500 rounded-full mt-4"></div></div>
          <div className="bg-white p-2 rounded-2xl shadow-sm border flex items-center gap-2">
            <CalendarIcon size={18} className="ml-3 text-slate-400"/><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="p-3 font-black outline-none bg-transparent cursor-pointer" />
          </div>
        </header>

        {activeTab === 'customers' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="relative max-w-xl"><Search className="absolute left-6 top-6 text-slate-300" size={20} /><input placeholder="搜尋姓名、地址、編號或機構..." className="w-full pl-16 pr-8 py-6 rounded-[2rem] shadow-sm outline-none focus:ring-4 focus:ring-orange-500/10 font-bold text-lg" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {customers.filter(c => c.name.includes(searchTerm) || c.institution.includes(searchTerm)).map(c => (
                <div key={c.id} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group flex flex-col">
                  <div className="flex justify-between items-start mb-6"><span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${c.type === 'CCSV 客戶' ? 'bg-blue-50 text-blue-500' : 'bg-slate-100 text-slate-400'}`}>{c.type}</span><button onClick={() => setSelectedCustomer(c)} className="p-3 bg-orange-50 text-orange-500 rounded-2xl group-hover:bg-orange-500 group-hover:text-white transition-all"><CalendarIcon size={20}/></button></div>
                  <h4 className="text-2xl font-black text-slate-800">{c.name}</h4>
                  <div className="mt-2 flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest"><Building2 size={12}/> {c.institution || "獨立個人"}</div>
                  <p className="text-xs text-slate-400 mt-6 leading-relaxed grow"><MapPin size={12} className="inline mr-2"/>{c.address}</p>
                  <button onClick={() => setSelectedCustomer(c)} className="mt-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-orange-600 transition-all shadow-lg">進入點餐管理</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'add' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border-4 border-dashed border-slate-100 flex flex-col items-center text-center">
              <Upload size={56} className="text-orange-500 mb-8" /><h3 className="text-2xl font-black mb-4">全月訂單批量導入 (Mass Import)</h3>
              <p className="text-sm text-slate-400 mb-10 max-w-md font-bold uppercase tracking-widest italic">支援「25A」或「15B-」格式。一行一個客，橫向填寫 1-31 號之點餐數量。</p>
              <label className="bg-orange-500 text-white px-10 py-5 rounded-3xl font-black text-lg cursor-pointer hover:bg-orange-600 transition-all shadow-xl">選擇檔案導入<input type="file" onChange={handleMassImportOrders} className="hidden" /></label>
            </div>
            <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border-4 border-dashed border-slate-100 flex flex-col items-center text-center">
              <Users size={56} className="text-blue-500 mb-8" /><h3 className="text-2xl font-black mb-4">批量導入客戶資料</h3>
              <label className="bg-blue-600 text-white px-10 py-5 rounded-3xl font-black text-lg cursor-pointer hover:bg-blue-700 transition-all shadow-xl">選擇客戶資料表<input type="file" onChange={handleCustImport} className="hidden" /></label>
            </div>
          </div>
        )}

        {activeTab === 'recon' && (
          <div className="bg-white rounded-[3rem] shadow-sm border overflow-hidden">
            <div className="p-10 border-b flex justify-between items-center bg-slate-50/50">
               <div><h3 className="font-black text-2xl tracking-tighter">機構月度對數彙報</h3><p className="text-[10px] text-slate-400 font-black uppercase mt-2">基準日期：{selectedDate}</p></div>
               <button className="flex items-center gap-3 bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-emerald-700 transition-all"><Download size={20}/> 導出對數 Excel</button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-slate-400 text-[10px] uppercase font-black tracking-widest"><th className="p-8 text-left">對數機構名稱</th><th className="p-8 text-center">類別</th><th className="p-8 text-center">A餐總量</th><th className="p-8 text-center">B餐總量</th><th className="p-8 text-center">C餐總量</th><th className="p-8 text-center">湯總量</th><th className="p-8 text-right">當日總計</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reconciliationData.map(r => (
                  <tr key={r.name} className="hover:bg-slate-50/50 transition-colors font-bold"><td className="p-8 text-lg font-black">{r.name}</td><td className="p-8 text-center"><span className="px-3 py-1 bg-slate-100 text-[9px] font-black rounded-full text-slate-400">{r.type}</span></td><td className="p-8 text-center text-orange-600">{r.A}</td><td className="p-8 text-center text-blue-600">{r.B}</td><td className="p-8 text-center text-emerald-600">{r.C}</td><td className="p-8 text-center text-slate-500">{r.Soup}</td><td className="p-8 text-right text-xl font-black">{r.total}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedCustomer && <CustomerCalendar customer={selectedCustomer} />}
      </main>
    </div>
  );
}
