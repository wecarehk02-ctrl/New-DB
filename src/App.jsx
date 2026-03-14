import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, ClipboardList, Printer, FileSpreadsheet, ChefHat, 
  Upload, Search, Plus, Download, Edit2, Check, X, Calendar as CalendarIcon, 
  Soup, ArrowLeft, ArrowRight, Trash2, MapPin, Building2, BarChart3, LogOut, Lock
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, doc, setDoc, query, where, getDocs, deleteDoc 
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';

// ==========================================
// 🚀 正式生產環境 Firebase 設定 (WeCare DB)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBs-iuaxif5Ruol0o95bvPHG7sAeBPIZCI",
  authDomain: "wecare-db-257a2.firebaseapp.com",
  projectId: "wecare-db-257a2",
  storageBucket: "wecare-db-257a2.firebasestorage.app",
  messagingSenderId: "9382815598",
  appId: "1:9382815598:web:0204da895acae71ba5037f",
  measurementId: "G-HZYF083SFN"
};

// 安全初始化 Firebase
let app, auth, db, initError = null;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  initError = error.message;
}

// --- 常量定義 ---
const TEXTURES = ['正', '碎', '免治', '分糊', '全糊'];
const MEALS = ['A', 'B', 'C'];
const ZONES = ['沙田及北區線', '葵青荃灣線', '觀塘線', '屯元天線', '土瓜環步兵', '團體線'];
const CUST_TYPES = ['普通個人', 'CCSV 客戶', '團體單'];

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState('customers'); 
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // 數據狀態
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menus, setMenus] = useState({});

  // UI 狀態
  const [selectedCustomer, setSelectedCustomer] = useState(null); 
  const [editingCustomer, setEditingCustomer] = useState(null); 
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); 
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');

  // --- 認證與登入檢查 ---
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (error) {
      setLoginError("登入失敗：請檢查電郵地址或密碼是否正確。");
    }
  };

  const handleLogout = async () => {
    if (window.confirm("確定要登出系統嗎？")) await signOut(auth);
  };

  // --- 數據監聽 (加入 Firebase Rules 權限錯誤提示) ---
  useEffect(() => {
    if (!user) return;

    const errorHandler = (err) => {
      console.error("Firestore Error:", err);
      if (err.message.includes("Missing or insufficient permissions")) {
        alert("🚨 嚴重錯誤：無法讀取資料！\n因為你嘅 Firebase Firestore 未開放讀寫權限。\n請去 Firebase 後台 -> Firestore Database -> Rules，將內容改為 allow read, write: if true;");
      }
    };

    const unsubCust = onSnapshot(collection(db, 'customers'), (snap) => {
      const data = snap.docs.map(d => d.data());
      setCustomers(data.sort((a,b) => String(a.id).localeCompare(String(b.id))));
    }, errorHandler);

    const unsubMenu = onSnapshot(collection(db, 'menus'), (snap) => {
      const mObj = {};
      snap.docs.forEach(d => mObj[d.id] = d.data());
      setMenus(mObj);
    }, errorHandler);

    const q = query(collection(db, 'orders'), where("date", "==", selectedDate));
    const unsubOrders = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => d.data()));
    }, errorHandler);

    return () => { unsubCust(); unsubMenu(); unsubOrders(); };
  }, [user, selectedDate]);

  // --- 批量導入邏輯 (智能識別 CSV 標題) ---
  const handleCustImport = async (e) => {
    const file = e.target.files[0];
    if (!file || !window.XLSX) return alert("請確保已載入 XLSX 庫");
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataBuffer = new Uint8Array(evt.target.result);
        const wb = window.XLSX.read(dataBuffer, { type: 'array' });
        const data = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        
        let count = 0;
        for (let row of data) {
          const keys = Object.keys(row);
          // 智能掃描標題，避開隱藏 BOM 字元
          const idKey = keys.find(k => k.replace(/^\uFEFF/, '').trim().toUpperCase() === 'ID' || k.includes('客戶ID'));
          const nameKey = keys.find(k => k.includes('姓名') || k.includes('Name'));
          const phoneKey = keys.find(k => k.includes('電話') || k.includes('Phone'));
          const addrKey = keys.find(k => k.includes('地址') || k.includes('Address'));
          const zoneKey = keys.find(k => k.includes('線路') || k.includes('Zone'));
          const reqKey = keys.find(k => k.includes('要求') || k.includes('備註'));
          
          const id = String(row[idKey] || "");
          if (id && id.trim() !== "") {
            await setDoc(doc(db, 'customers', id), {
              id, 
              name: String(row[nameKey] || ""), 
              address: String(row[addrKey] || ""), 
              phone: String(row[phoneKey] || ""), 
              zone: String(row[zoneKey] || ZONES[0]), 
              type: CUST_TYPES[0], 
              institution: "", 
              requirement: String(row[reqKey] || "")
            });
            count++;
          }
        }
        alert(`✅ 成功導入 ${count} 個客戶！\n如果無顯示，請去 Firebase 開啟 Rules 權限。`);
      } catch (err) { alert("導入出錯：" + err.message); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMassImportOrders = async (e) => {
    const file = e.target.files[0];
    if (!file || !window.XLSX) return alert("請確保已載入 XLSX 庫");
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataBuffer = new Uint8Array(evt.target.result);
      const wb = window.XLSX.read(dataBuffer, { type: 'array' });
      const data = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      
      for (let row of data) {
        const keys = Object.keys(row);
        const idKey = keys.find(k => k.replace(/^\uFEFF/, '').trim().toUpperCase() === 'ID' || k.includes('客戶ID'));
        const custId = String(row[idKey] || "");
        if (!custId) continue;

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
            await setDoc(doc(db, 'orders', `${dateStr}_${custId}`), {
              date: dateStr, customerId: custId, counts: { [`${meal}_${texture}`]: qty }, noSoup: skipSoup
            }, { merge: true });
          }
        }
      }
      alert("批量訂單導入完成！");
    };
    reader.readAsArrayBuffer(file);
  };

  // --- 當日餐點總計 (Daily Summary) ---
  const dailySummary = useMemo(() => {
    const summary = {
      A: { total: 0, 正: 0, 碎: 0, 免治: 0, 分糊: 0, 全糊: 0 },
      B: { total: 0, 正: 0, 碎: 0, 免治: 0, 分糊: 0, 全糊: 0 },
      C: { total: 0, 正: 0, 碎: 0, 免治: 0, 分糊: 0, 全糊: 0 },
      Soup: 0
    };
    
    orders.forEach(o => {
      let hasMeal = false;
      let totalMealsForThisOrder = 0;
      
      Object.keys(o.counts || {}).forEach(k => {
        const qty = parseInt(o.counts[k]) || 0;
        if (qty > 0) {
          const [meal, tex] = k.split('_');
          if (summary[meal] && summary[meal][tex] !== undefined) {
            summary[meal][tex] += qty;
            summary[meal].total += qty;
            totalMealsForThisOrder += qty;
            hasMeal = true;
          }
        }
      });
      
      // 湯品：如果無走湯，餐數有幾多，湯就送幾多碗
      if (hasMeal && !o.noSoup) {
        summary.Soup += totalMealsForThisOrder;
      }
    });
    return summary;
  }, [orders]);

  // --- 月度對數報表統計 ---
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
        const qty = parseInt(o.counts[k]) || 0;
        if (meal === 'A') report[groupKey].A += qty;
        if (meal === 'B') report[groupKey].B += qty;
        if (meal === 'C') report[groupKey].C += qty;
        report[groupKey].total += qty;
      });
      if (!o.noSoup) report[groupKey].Soup += 1;
    });
    return Object.values(report);
  }, [orders, customers]);


  // ==========================================
  // 🔒 登入介面
  // ==========================================
  if (initError) return <div className="p-10 text-red-500 font-bold">{initError}</div>;
  if (isAuthChecking) return <div className="p-10 font-bold">系統載入中...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-3 bg-orange-500"></div>
          <div className="flex flex-col items-center mb-10">
            <div className="w-24 h-24 bg-slate-50 rounded-3xl p-2 mb-6 flex items-center justify-center shadow-inner">
              <img src="/logo.png" alt="WeCare Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-4xl font-black italic text-slate-900 tracking-tighter">WECARE</h1>
            <p className="text-xs text-orange-500 font-bold uppercase tracking-widest mt-2">Operations Engine</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">員工電郵 (Email)</label>
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl outline-none focus:border-orange-500 transition-all font-bold" placeholder="admin@wecare.com" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">密碼 (Password)</label>
              <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl outline-none focus:border-orange-500 transition-all font-bold" placeholder="••••••••" />
            </div>
            {loginError && <div className="text-red-500 text-xs font-bold text-center bg-red-50 p-3 rounded-xl">{loginError}</div>}
            <button type="submit" className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-lg hover:bg-orange-500 transition-all flex justify-center items-center gap-2"><Lock size={18} /> 登入系統</button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // 📝 編輯與刪除客戶組件
  // ==========================================
  const CustomerEditModal = ({ customer, onClose }) => {
    const [form, setForm] = useState(customer);

    const handleSave = async () => {
      if (!form.name) return alert("姓名不能為空！");
      try {
        await setDoc(doc(db, 'customers', customer.id), form, { merge: true });
        alert("資料已更新！");
        onClose();
      } catch (err) { alert("更新失敗：" + err.message); }
    };

    const handleDelete = async () => {
      if (window.confirm(`⚠️ 警告：確定要永久刪除客戶「${customer.name}」嗎？\n此操作無法復原，請確認！`)) {
        try {
          await deleteDoc(doc(db, 'customers', customer.id));
          alert("客戶資料已徹底刪除。");
          onClose();
        } catch (err) { alert("刪除失敗：" + err.message); }
      }
    };

    return (
      <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-2xl">
          <div className="p-8 border-b flex justify-between items-center bg-slate-50">
            <div><h3 className="text-2xl font-black text-slate-800">修改客戶資料</h3><p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">ID: {customer.id}</p></div>
            <button onClick={onClose} className="p-3 bg-slate-200 rounded-xl hover:bg-slate-300 transition-colors"><X size={20}/></button>
          </div>
          <div className="p-8 grid grid-cols-2 gap-6 bg-white">
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">姓名</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" /></div>
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">聯絡電話</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" /></div>
            <div className="space-y-2 col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">派送地址</label><input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" /></div>
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">派送線路</label><select value={form.zone} onChange={e => setForm({...form, zone: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold appearance-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select></div>
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">客戶類別</label><select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold appearance-none">{CUST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">對數機構 (如有)</label><input value={form.institution} onChange={e => setForm({...form, institution: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" placeholder="例如：東華三院" /></div>
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">特別要求 / 備註</label><input value={form.requirement} onChange={e => setForm({...form, requirement: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" placeholder="例如：要餐具" /></div>
          </div>
          <div className="p-8 border-t bg-slate-50 flex justify-between items-center">
            <button onClick={handleDelete} className="flex items-center gap-2 text-red-500 font-black hover:bg-red-100 p-4 rounded-2xl transition-colors"><Trash2 size={18}/> 刪除客戶</button>
            <div className="flex gap-3">
              <button onClick={onClose} className="font-black text-slate-400 px-6 py-4 hover:text-slate-600 transition-colors">取消</button>
              <button onClick={handleSave} className="bg-slate-900 text-white font-black px-8 py-4 rounded-2xl hover:bg-emerald-500 transition-colors shadow-lg flex items-center gap-2"><Check size={18}/> 儲存</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // 📅 月曆點餐組件
  // ==========================================
  const CustomerCalendar = ({ customer }) => {
    const [monthOrders, setMonthOrders] = useState([]);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    useEffect(() => {
      const fetchMonthData = async () => {
        const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const q = query(collection(db, 'orders'), where("customerId", "==", customer.id));
        const s = await getDocs(q);
        setMonthOrders(s.docs.map(d => d.data()).filter(o => o.date.startsWith(prefix)));
      };
      fetchMonthData();
    }, [customer.id, currentMonth]);

    const updateQty = async (dateStr, meal, texture, val) => {
      const qty = Math.max(0, parseInt(val) || 0);
      const orderId = `${dateStr}_${customer.id}`;
      const existing = monthOrders.find(o => o.date === dateStr) || { counts: {}, noSoup: false };
      const newOrder = { ...existing, date: dateStr, customerId: customer.id, counts: { ...existing.counts, [`${meal}_${texture}`]: qty } };
      await setDoc(doc(db, 'orders', orderId), newOrder, { merge: true });
      setMonthOrders(prev => [...prev.filter(o => o.date !== dateStr), newOrder]);
    };

    return (
      <div className="fixed inset-0 bg-slate-900/95 z-50 flex items-center justify-center p-2">
        <div className="bg-white rounded-[2rem] w-full max-w-[98vw] h-[96vh] flex flex-col overflow-hidden shadow-2xl">
          <div className="p-6 border-b flex justify-between items-center bg-slate-50">
            <div><h3 className="text-4xl font-black text-slate-800">{customer.name} - 點餐明細</h3><p className="text-sm text-slate-500 font-bold uppercase mt-2">{currentYear}年 {currentMonth + 1}月 | 機構: {customer.institution || '獨立個人'}</p></div>
            <div className="flex gap-3">
              <button onClick={() => setCurrentMonth(m => m === 0 ? 11 : m - 1)} className="p-4 border-2 rounded-2xl hover:bg-white bg-slate-50"><ArrowLeft size={24}/></button>
              <button onClick={() => setCurrentMonth(m => m === 11 ? 0 : m + 1)} className="p-4 border-2 rounded-2xl hover:bg-white bg-slate-50"><ArrowRight size={24}/></button>
              <button onClick={() => setSelectedCustomer(null)} className="ml-6 p-4 bg-red-500 text-white rounded-2xl hover:bg-red-600 shadow-lg"><X size={24}/></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 bg-slate-100/50">
            <div className="grid grid-cols-7 gap-3">
              {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-center text-sm font-black text-slate-400 uppercase py-2">{d}</div>)}
              {[...Array(new Date(currentYear, currentMonth, 1).getDay())].map((_, i) => <div key={`empty-${i}`} />)}
              {[...Array(daysInMonth)].map((_, i) => {
                const day = i + 1;
                const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const order = monthOrders.find(o => o.date === dateStr) || { counts: {}, noSoup: false };
                const dayMenu = menus[dateStr] || { A: '', B: '', C: '', Soup: '' };
                const total = Object.values(order.counts || {}).reduce((a, b) => a + b, 0);

                return (
                  <div key={day} className={`border-2 rounded-[1.5rem] p-4 flex flex-col gap-3 min-h-[300px] transition-all ${total > 0 ? 'bg-white border-orange-300 shadow-xl' : 'bg-slate-50/80 border-slate-200'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-3xl font-black text-slate-700">{day}</span>
                      <button onClick={async () => {
                          const newNoSoup = !order.noSoup;
                          await setDoc(doc(db, 'orders', `${dateStr}_${customer.id}`), { noSoup: newNoSoup }, { merge: true });
                          setMonthOrders(prev => prev.map(o => o.date === dateStr ? {...o, noSoup: newNoSoup} : o));
                        }} className={`text-sm px-4 py-2 rounded-xl font-black shadow-sm ${order.noSoup ? 'bg-red-500 text-white' : 'bg-emerald-100 text-emerald-700'}`}>{order.noSoup ? '走湯' : '連湯'}</button>
                    </div>
                    <div className="space-y-4 flex-1">
                      {MEALS.map(m => (
                        <div key={m} className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <div className="text-xs font-black text-orange-600 mb-2 truncate">({m}) {dayMenu[m] || '未設定'}</div>
                          <div className="grid grid-cols-5 gap-1.5">
                            {TEXTURES.map(t => (
                              <div key={t} className="flex flex-col items-center">
                                <span className="text-[10px] text-slate-500 font-bold mb-1">{t}</span>
                                <input type="number" min="0" value={order.counts[`${m}_${t}`] || ''} onChange={(e) => updateQty(dateStr, m, t, e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm font-black text-center outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="0" />
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
        <div className="flex items-center gap-4 mb-12">
          <div className="w-14 h-14 bg-white rounded-2xl p-1 overflow-hidden flex items-center justify-center shadow-inner">
            <img src="/logo.png" alt="WeCare Logo" className="w-full h-full object-contain" />
          </div>
          <div><h1 className="text-2xl font-black italic text-orange-500 tracking-tighter leading-none">WECARE</h1><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Operations Pro</p></div>
        </div>
        <nav className="flex-1 space-y-2">
          <button onClick={() => setActiveTab('customers')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'customers' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Users size={20}/> 客戶資料管理</button>
          <button onClick={() => setActiveTab('add')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'add' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Plus size={20}/> 新增客戶 (批量)</button>
          <button onClick={() => setActiveTab('menu')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'menu' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><ChefHat size={20}/> 每月餐單 (批量)</button>
          <button onClick={() => setActiveTab('stickers')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'stickers' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Printer size={20}/> 列印出餐貼紙</button>
          <button onClick={() => setActiveTab('recon')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'recon' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><BarChart3 size={20}/> 月度機構對數</button>
        </nav>
        <div className="pt-6 border-t border-slate-800 mt-auto">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3 ml-2">當前使用者: {user?.email}</div>
          <button onClick={handleLogout} className="w-full text-left p-4 rounded-2xl flex items-center gap-4 text-red-400 hover:bg-red-500 hover:text-white transition-all font-bold"><LogOut size={20}/> 登出系統</button>
        </div>
      </aside>

      {/* 主介面 */}
      <main className="flex-1 ml-72 p-12 h-screen overflow-y-auto">
        <header className="flex justify-between items-end mb-12 no-print">
          <div><h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter">{activeTab}</h2><div className="h-1.5 w-24 bg-orange-500 rounded-full mt-4"></div></div>
          <div className="bg-white p-2 rounded-2xl shadow-sm border flex items-center gap-2">
            <CalendarIcon size={18} className="ml-3 text-slate-400"/><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="p-3 font-black outline-none bg-transparent cursor-pointer" />
          </div>
        </header>

        {activeTab === 'customers' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="relative max-w-xl"><Search className="absolute left-6 top-6 text-slate-300" size={20} /><input placeholder="搜尋姓名、地址、編號或機構..." className="w-full pl-16 pr-8 py-6 rounded-[2rem] shadow-sm border-none outline-none focus:ring-4 focus:ring-orange-500/10 font-bold text-lg transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {customers.filter(c => c.name.includes(searchTerm) || c.institution.includes(searchTerm) || c.id.includes(searchTerm)).map(c => (
                <div key={c.id} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group flex flex-col h-full">
                  <div className="flex justify-between items-start mb-6">
                    <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${c.type === 'CCSV 客戶' ? 'bg-blue-50 text-blue-500' : c.type === '團體單' ? 'bg-orange-50 text-orange-500' : 'bg-slate-100 text-slate-400'}`}>{c.type}</span>
                    <button onClick={() => setSelectedCustomer(c)} className="p-3 bg-orange-50 text-orange-500 rounded-2xl group-hover:bg-orange-500 group-hover:text-white transition-all"><CalendarIcon size={20}/></button>
                  </div>
                  <h4 className="text-2xl font-black text-slate-800 leading-tight">{c.name}</h4>
                  <div className="mt-2 flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest"><Building2 size={12}/> {c.institution || "獨立個人"}</div>
                  <p className="text-xs text-slate-400 mt-6 leading-relaxed grow line-clamp-2"><MapPin size={12} className="inline mr-2"/>{c.address}</p>
                  <div className="mt-8 flex gap-3 pt-6 border-t border-slate-50">
                    <button onClick={() => setSelectedCustomer(c)} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-orange-600 transition-all shadow-lg active:scale-95">全月點餐月曆</button>
                    <button onClick={() => setEditingCustomer(c)} className="p-4 border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 hover:border-slate-900 transition-all bg-white"><Edit2 size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'add' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white p-16 rounded-[4rem] shadow-sm border-4 border-dashed border-slate-100 flex flex-col items-center text-center">
              <Upload size={56} className="text-orange-500 mb-8" />
              <h3 className="text-2xl font-black mb-4">全月批量訂單導入 (Excel)</h3>
              <p className="text-sm text-slate-400 mb-10 max-w-md font-bold uppercase tracking-widest italic leading-relaxed">支援「25A」或「15B-」格式。橫向填寫 1-31 號之點餐數量及類別。</p>
              <label className="bg-orange-500 text-white px-12 py-5 rounded-3xl font-black text-lg cursor-pointer hover:bg-orange-600 transition-all shadow-xl active:scale-95">選擇檔案導入<input type="file" onChange={handleMassImportOrders} className="hidden" /></label>
            </div>
            <div className="bg-white p-16 rounded-[4rem] shadow-sm border-4 border-dashed border-slate-100 flex flex-col items-center text-center">
              <Users size={56} className="text-blue-500 mb-8" />
              <h3 className="text-2xl font-black mb-4">批量導入客戶基本資料表</h3>
              <label className="bg-blue-600 text-white px-12 py-5 rounded-3xl font-black text-lg cursor-pointer hover:bg-blue-700 transition-all shadow-xl active:scale-95">選擇客戶表導入<input type="file" onChange={handleCustImport} className="hidden" /></label>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 🔥 加入了「今日出餐總計」的列印貼紙頁面 */}
        {/* ==================================================== */}
        {activeTab === 'stickers' && (
          <div className="space-y-8 no-print">
             {/* 總結面版 */}
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-6">
               <div className="flex items-center justify-between">
                 <div>
                   <h4 className="font-black text-3xl text-slate-800 tracking-tighter">今日出餐總計</h4>
                   <p className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-widest">Daily Meal Summary</p>
                 </div>
                 <button onClick={() => window.print()} className="bg-orange-500 text-white px-10 py-5 rounded-2xl font-black shadow-lg shadow-orange-500/30 active:scale-95">列印所有出餐貼紙</button>
               </div>
               
               <div className="grid grid-cols-4 gap-6">
                 {MEALS.map(m => (
                   <div key={m} className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                     <div className="font-black text-xl text-slate-700 mb-4 pb-4 border-b border-slate-200">{m}餐 <span className="text-orange-500 ml-2">共 {dailySummary[m].total} 份</span></div>
                     <div className="space-y-2">
                       {TEXTURES.map(t => dailySummary[m][t] > 0 && (
                         <div key={t} className="flex justify-between items-center text-sm font-bold text-slate-600">
                           <span>{t}</span><span className="bg-white px-3 py-1 rounded-lg border">{dailySummary[m][t]}</span>
                         </div>
                       ))}
                       {dailySummary[m].total === 0 && <div className="text-xs text-slate-400 font-bold">無訂單</div>}
                     </div>
                   </div>
                 ))}
                 <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex flex-col justify-center items-center text-center">
                   <div className="font-black text-xl text-emerald-800 mb-2">例湯總數</div>
                   <div className="text-6xl font-black text-emerald-500">{dailySummary.Soup}</div>
                   <div className="text-[10px] text-emerald-600/70 font-bold mt-2 uppercase tracking-widest">Bowls of Soup</div>
                 </div>
               </div>
             </div>
             
             {/* 貼紙區 */}
             <div className="grid grid-cols-2 gap-4">
                {orders.map(o => {
                  const c = customers.find(cust => cust.id === o.customerId);
                  if(!c) return null;
                  const totalCounts = Object.values(o.counts || {}).reduce((a, b) => a + b, 0);
                  if(totalCounts === 0) return null;

                  return (
                    <div key={o.customerId} className="bg-white border-2 border-black p-6 h-[320px] relative flex flex-col font-bold break-inside-avoid">
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
               <div><h3 className="font-black text-2xl tracking-tighter">機構對數月度彙報</h3><p className="text-[10px] text-slate-400 font-black uppercase mt-2 tracking-widest">目前日期：{selectedDate}</p></div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-slate-400 text-[10px] uppercase font-black tracking-widest">
                  <th className="p-8 text-left">對數機構名稱</th>
                  <th className="p-8 text-center">A餐總量</th>
                  <th className="p-8 text-center">B餐總量</th>
                  <th className="p-8 text-center">C餐總量</th>
                  <th className="p-8 text-center">例湯數</th>
                  <th className="p-8 text-right">當日總計</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold">
                {reconciliationData.map(r => (
                  <tr key={r.name} className="hover:bg-slate-50/50 transition-colors font-bold">
                    <td className="p-8 text-lg font-black text-slate-800">{r.name}</td>
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
        {editingCustomer && <CustomerEditModal customer={editingCustomer} onClose={() => setEditingCustomer(null)} />}
      </main>
      
      <style>{`
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        @media print {
          .no-print { display: none !important; }
          main { margin-left: 0 !important; padding: 0 !important; background: white; }
          .grid { display: grid !important; grid-template-cols: 1fr 1fr !important; gap: 10px !important; }
          .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
