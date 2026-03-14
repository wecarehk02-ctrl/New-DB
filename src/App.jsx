import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, ClipboardList, Printer, FileSpreadsheet, ChefHat, 
  Upload, Search, Plus, Download, Edit2, Check, X, Calendar as CalendarIcon, 
  Soup, ArrowLeft, ArrowRight, Trash2, MapPin, Building2, BarChart3, LogOut, Lock, Settings // 🆕 加咗 Settings Icon
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, doc, setDoc, query, where, getDocs, deleteDoc 
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';

// ==========================================
// 🚀 正式生產環境 Firebase 設定
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

let app, auth, db, initError = null;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  initError = error.message;
}

const TEXTURES = ['正', '碎', '免治', '分糊', '全糊'];
const MEALS = ['A', 'B', 'C'];
// 🆕 ZONES 改做預設值，真正數據由系統設定 Firebase 讀取
const DEFAULT_ZONES = ['沙田及北區線', '葵青荃灣線', '觀塘線', '屯元天線', '土瓜環步兵', '團體線'];
const CUST_TYPES = ['普通個人', 'CCSV 客戶', '團體單'];

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState('customers'); 
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [monthlyOrders, setMonthlyOrders] = useState([]); // 🆕 新增：儲存對數用嘅全月訂單
  const [menus, setMenus] = useState({});
  
  // 🆕 新增：系統動態選項狀態
  const [sysSettings, setSysSettings] = useState({ zones: DEFAULT_ZONES, institutions: [] });

  const [selectedCustomer, setSelectedCustomer] = useState(null); 
  const [editingCustomer, setEditingCustomer] = useState(null); 
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); 
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');

  // --- 認證 ---
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

  // --- 數據監聽 ---
  useEffect(() => {
    if (!user) return;
    const unsubCust = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(d => d.data()).sort((a,b) => String(a.id).localeCompare(String(b.id))));
    });
    const unsubMenu = onSnapshot(collection(db, 'menus'), (snap) => {
      const mObj = {};
      snap.docs.forEach(d => mObj[d.id] = d.data());
      setMenus(mObj);
    });
    // 監聽單日訂單 (廚房總表/貼紙用)
    const qOrders = query(collection(db, 'orders'), where("date", "==", selectedDate));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      setOrders(snap.docs.map(d => d.data()));
    });
    
    // 🆕 監聽系統設定 (路線、機構)
    const unsubSettings = onSnapshot(doc(db, 'settings', 'options'), (docSnap) => {
      if (docSnap.exists()) {
        setSysSettings(prev => ({ ...prev, ...docSnap.data() }));
      }
    });

    return () => { unsubCust(); unsubMenu(); unsubOrders(); unsubSettings(); };
  }, [user, selectedDate]);

  // 🆕 獨立監聽全月訂單 (專為「月度對數」而設)
  useEffect(() => {
    if (!user) return;
    const monthPrefix = selectedDate.substring(0, 7); // 取 "YYYY-MM"
    const qMonth = query(
      collection(db, 'orders'),
      where("date", ">=", `${monthPrefix}-01`),
      where("date", "<=", `${monthPrefix}-31`)
    );
    const unsubMonthly = onSnapshot(qMonth, (snap) => {
      setMonthlyOrders(snap.docs.map(d => d.data()));
    });
    return () => unsubMonthly();
  }, [user, selectedDate]);

  // --- 導入邏輯 ---
  const handleCustImport = async (e) => {
    const file = e.target.files[0];
    if (!file || !window.XLSX) return alert("請確保已載入 XLSX 庫");
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataBuffer = new Uint8Array(evt.target.result);
        const wb = window.XLSX.read(dataBuffer, { type: 'array' });
        const data = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        for (let row of data) {
          const keys = Object.keys(row);
          const findKey = (search) => keys.find(k => k.replace(/^\uFEFF/, '').trim().includes(search));
          const id = String(row[findKey('ID')] || row[findKey('id')] || "");
          if (id && id.trim() !== "" && id !== "undefined") {
            await setDoc(doc(db, 'customers', id), {
              id, name: String(row[findKey('姓名')] || ""), address: String(row[findKey('地址')] || ""), 
              phone: String(row[findKey('電話')] || ""), zone: String(row[findKey('線路')] || sysSettings.zones[0] || ""), 
              type: CUST_TYPES[0], institution: "", requirement: String(row[findKey('要求')] || row[findKey('備註')] || "")
            });
          }
        }
        alert("客戶資料導入成功！");
      } catch (err) { alert("導入出錯：" + err.message); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMassImportOrders = async (e) => {
    const file = e.target.files[0];
    if (!file || !window.XLSX) return;
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
            // 批量導入暫設湯為 0，可按需要調整
            await setDoc(doc(db, 'orders', `${dateStr}_${custId}`), {
              date: dateStr, customerId: custId, counts: { [`${meal}_${texture}`]: qty }, soupQty: 0
            }, { merge: true });
          }
        }
      }
      alert("批量訂單導入完成！");
    };
    reader.readAsArrayBuffer(file);
  };

  // --- 數據統計 (廚房總表/貼紙用) ---
  const dailySummary = useMemo(() => {
    const summary = { A: { total: 0 }, B: { total: 0 }, C: { total: 0 }, Soup: 0 };
    TEXTURES.forEach(t => { summary.A[t] = 0; summary.B[t] = 0; summary.C[t] = 0; });
    
    orders.forEach(o => {
      Object.keys(o.counts || {}).forEach(k => {
        const qty = parseInt(o.counts[k]) || 0;
        if (qty > 0) {
          const [meal, tex] = k.split('_');
          if (summary[meal] && summary[meal][tex] !== undefined) {
            summary[meal][tex] += qty;
            summary[meal].total += qty;
          }
        }
      });
      // 🆕 改為讀取手動輸入嘅 soupQty
      summary.Soup += (parseInt(o.soupQty) || 0);
    });
    return summary;
  }, [orders]);

  // 🆕 改寫：月度對數表數據計算 (以 monthlyOrders 為基礎，按機構及團體單顯示)
  const monthlyReconciliationData = useMemo(() => {
    const report = {};
    monthlyOrders.forEach(o => {
      const cust = customers.find(c => c.id === o.customerId);
      if (!cust) return;
      const groupKey = cust.institution || "獨立個人客戶";
      
      if (!report[groupKey]) {
        report[groupKey] = { name: groupKey, totalMeals: 0, totalSoup: 0, groups: {} };
      }
      
      // 記錄該機構底下嘅團體單明細
      if (!report[groupKey].groups[cust.id]) {
        report[groupKey].groups[cust.id] = { name: cust.name, type: cust.type, meals: 0, soup: 0 };
      }
      
      let totalMealsForOrder = 0;
      Object.keys(o.counts || {}).forEach(k => {
        totalMealsForOrder += (parseInt(o.counts[k]) || 0);
      });
      const soupQty = parseInt(o.soupQty) || 0;

      // 累加數值
      report[groupKey].totalMeals += totalMealsForOrder;
      report[groupKey].totalSoup += soupQty;
      
      report[groupKey].groups[cust.id].meals += totalMealsForOrder;
      report[groupKey].groups[cust.id].soup += soupQty;
    });
    return Object.values(report).sort((a,b) => b.totalMeals - a.totalMeals); // 按單量排序
  }, [monthlyOrders, customers]);

  // --- 導出廚房總表 ---
  const exportKitchenExcel = () => {
    if (!window.XLSX) return alert("請確保已載入 XLSX 庫");
    const reportData = [];
    TEXTURES.forEach(t => {
      reportData.push({ "規格": t, "A餐": dailySummary.A[t], "B餐": dailySummary.B[t], "C餐": dailySummary.C[t] });
    });
    reportData.push({ "規格": "總計", "A餐": dailySummary.A.total, "B餐": dailySummary.B.total, "C餐": dailySummary.C.total });
    reportData.push({ "規格": "", "A餐": "", "B餐": "", "C餐": "" });
    reportData.push({ "規格": "今日例湯總數量", "A餐": dailySummary.Soup, "B餐": "", "C餐": "" });

    const ws = window.XLSX.utils.json_to_sheet(reportData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "廚房總表");
    window.XLSX.writeFile(wb, `WeCare_廚房總表_${selectedDate}.xlsx`);
  };

  // ==========================================
  // 🔒 登入介面
  // ==========================================
  if (initError) return <div className="p-10 font-bold text-red-500">{initError}</div>;
  if (isAuthChecking) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400">系統載入中...</div>;
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-3 bg-orange-500"></div>
          <div className="flex flex-col items-center mb-10">
            <div className="w-24 h-24 bg-slate-50 rounded-3xl p-2 mb-6 flex items-center justify-center shadow-inner">
              <img src="/logo.png" alt="WeCare" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-4xl font-black italic text-slate-900 tracking-tighter">WECARE</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className="w-full bg-slate-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" placeholder="員工電郵" />
            <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required className="w-full bg-slate-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" placeholder="登入密碼" />
            {loginError && <div className="text-red-500 text-xs font-bold text-center">{loginError}</div>}
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
      try { await setDoc(doc(db, 'customers', customer.id), form, { merge: true }); alert("資料已更新！"); onClose(); }
      catch (err) { alert("更新失敗：" + err.message); }
    };
    const handleDelete = async () => {
      if (window.confirm(`⚠️ 警告：確定要永久刪除客戶「${customer.name}」嗎？`)) {
        await deleteDoc(doc(db, 'customers', customer.id));
        alert("客戶資料已徹底刪除。");
        onClose();
      }
    };

    return (
      <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-2xl">
          <div className="p-8 border-b flex justify-between items-center bg-slate-50">
            <div><h3 className="text-2xl font-black">修改客戶資料</h3><p className="text-xs font-bold text-slate-400 mt-1">ID: {customer.id}</p></div>
            <button onClick={onClose} className="p-3 bg-slate-200 rounded-xl hover:bg-slate-300"><X size={20}/></button>
          </div>
          <div className="p-8 grid grid-cols-2 gap-6">
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">姓名</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" /></div>
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">電話</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" /></div>
            <div className="space-y-2 col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">地址</label><input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" /></div>
            
            {/* 🆕 動態路線 Option */}
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">線路</label>
              <select value={form.zone} onChange={e => setForm({...form, zone: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none">
                <option value="">請選擇線路...</option>
                {sysSettings.zones.map(z => <option key={z}>{z}</option>)}
              </select>
            </div>
            
            {/* 🆕 動態機構 Option (可搜尋輸入框) */}
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">機構</label>
              <input list="inst-options" value={form.institution} onChange={e => setForm({...form, institution: e.target.value})} placeholder="選擇或輸入機構..." className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" />
              <datalist id="inst-options">
                {sysSettings.institutions.map(inst => <option key={inst} value={inst} />)}
              </datalist>
            </div>
          </div>
          <div className="p-8 border-t bg-slate-50 flex justify-between items-center">
            <button onClick={handleDelete} className="text-red-500 font-black hover:bg-red-100 p-4 rounded-2xl flex gap-2"><Trash2 size={18}/> 刪除客戶</button>
            <div className="flex gap-3">
              <button onClick={onClose} className="font-black text-slate-400 px-6">取消</button>
              <button onClick={handleSave} className="bg-slate-900 text-white font-black px-8 py-4 rounded-2xl shadow-lg flex gap-2"><Check size={18}/> 儲存</button>
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
      const existing = monthOrders.find(o => o.date === dateStr) || { counts: {}, soupQty: 0 };
      const newOrder = { ...existing, date: dateStr, customerId: customer.id, counts: { ...existing.counts, [`${meal}_${texture}`]: qty } };
      await setDoc(doc(db, 'orders', orderId), newOrder, { merge: true });
      setMonthOrders(prev => [...prev.filter(o => o.date !== dateStr), newOrder]);
    };

    // 🆕 更新餐湯數量 (獨立欄位)
    const updateSoup = async (dateStr, val) => {
      const qty = Math.max(0, parseInt(val) || 0);
      const orderId = `${dateStr}_${customer.id}`;
      const existing = monthOrders.find(o => o.date === dateStr) || { counts: {}, soupQty: 0 };
      const newOrder = { ...existing, date: dateStr, customerId: customer.id, soupQty: qty };
      await setDoc(doc(db, 'orders', orderId), { soupQty: qty }, { merge: true });
      setMonthOrders(prev => [...prev.filter(o => o.date !== dateStr), newOrder]);
    };

    return (
      <div className="fixed inset-0 bg-slate-900/95 z-50 flex items-center justify-center p-2">
        <div className="bg-white rounded-[2rem] w-full max-w-[98vw] h-[98vh] flex flex-col overflow-hidden shadow-2xl">
          <div className="p-6 border-b flex justify-between items-center bg-slate-50">
            <div><h3 className="text-4xl font-black text-slate-800">{customer.name} - 點餐明細</h3><p className="text-sm text-slate-500 font-bold mt-2">{currentYear}年 {currentMonth + 1}月 | 機構: {customer.institution || '獨立個人'}</p></div>
            <div className="flex gap-3">
              <button onClick={() => setCurrentMonth(m => m === 0 ? 11 : m - 1)} className="p-4 border-2 rounded-2xl bg-white"><ArrowLeft size={24}/></button>
              <button onClick={() => setCurrentMonth(m => m === 11 ? 0 : m + 1)} className="p-4 border-2 rounded-2xl bg-white"><ArrowRight size={24}/></button>
              <button onClick={() => setSelectedCustomer(null)} className="ml-6 p-4 bg-red-500 text-white rounded-2xl shadow-lg"><X size={24}/></button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-4 bg-slate-100/50">
            <div className="grid grid-cols-7 gap-3">
              {['日','一','二','三','四','五','六'].map(d => (
                <div key={d} className="text-center text-sm font-black text-slate-400 uppercase py-2 tracking-widest">{d}</div>
              ))}
              {[...Array(new Date(currentYear, currentMonth, 1).getDay())].map((_, i) => <div key={`empty-${i}`} />)}
              {[...Array(daysInMonth)].map((_, i) => {
                const day = i + 1;
                const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const order = monthOrders.find(o => o.date === dateStr) || { counts: {}, soupQty: 0 };
                const dayMenu = menus[dateStr] || { A: '', B: '', C: '', Soup: '' };
                const total = Object.values(order.counts || {}).reduce((a, b) => a + b, 0) + (parseInt(order.soupQty) || 0);

                return (
                  <div key={day} className={`border-2 rounded-[1.5rem] p-4 flex flex-col gap-3 min-h-[320px] transition-all ${total > 0 ? 'bg-white border-orange-300 shadow-xl' : 'bg-slate-50/80 border-slate-200'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-3xl font-black text-slate-700">{day}</span>
                      {/* 🆕 手動輸入例湯數量 */}
                      <div className="flex items-center gap-2 bg-emerald-50 px-2 py-1 rounded-xl border border-emerald-100">
                        <span className="text-xs font-black text-emerald-700">例湯</span>
                        <input type="number" min="0" value={order.soupQty || ''} onChange={(e) => updateSoup(dateStr, e.target.value)} placeholder="0" className="w-10 text-center font-black rounded-md outline-none bg-white py-1" />
                      </div>
                    </div>
                    
                    <div className="space-y-3 flex-1">
                      {MEALS.map(m => (
                        <div key={m} className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <div className="text-sm font-black text-orange-600 mb-2 truncate">({m}) {dayMenu[m] || '未設定'}</div>
                          <div className="flex justify-between gap-1">
                            {TEXTURES.map(t => (
                              <div key={t} className="flex flex-col items-center min-w-[36px] flex-1">
                                <span className="text-[10px] text-slate-500 font-bold mb-1 whitespace-nowrap">{t}</span>
                                <input 
                                  type="number" min="0" value={order.counts[`${m}_${t}`] || ''} 
                                  onChange={(e) => updateQty(dateStr, m, t, e.target.value)}
                                  className="w-full bg-white border border-slate-300 rounded-md py-1.5 px-0 text-base font-black text-center outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
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
      <aside className="w-72 bg-slate-900 text-white p-8 no-print fixed h-full z-20 flex flex-col">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-14 h-14 bg-white rounded-2xl p-1 overflow-hidden flex items-center justify-center shadow-inner"><img src="/logo.png" alt="WeCare Logo" className="w-full h-full object-contain" /></div>
          <div><h1 className="text-2xl font-black italic text-orange-500 tracking-tighter leading-none">WECARE</h1><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Operations Pro</p></div>
        </div>
        <nav className="flex-1 space-y-2">
          <button onClick={() => setActiveTab('customers')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'customers' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Users size={20}/> 客戶資料管理</button>
          <button onClick={() => setActiveTab('add')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'add' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Plus size={20}/> 新增/批量導入</button>
          <button onClick={() => setActiveTab('menu')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'menu' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><ChefHat size={20}/> 每月餐單 (批量)</button>
          <button onClick={() => setActiveTab('stickers')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'stickers' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Printer size={20}/> 今日營運與標籤</button>
          <button onClick={() => setActiveTab('recon')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'recon' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><BarChart3 size={20}/> 月度機構對數</button>
          {/* 🆕 系統設定 Tab */}
          <button onClick={() => setActiveTab('settings')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'settings' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Settings size={20}/> 系統選項設定</button>
        </nav>
        <div className="pt-6 border-t border-slate-800 mt-auto">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3 ml-2">使用者: {user?.email}</div>
          <button onClick={handleLogout} className="w-full text-left p-4 rounded-2xl flex items-center gap-4 text-red-400 hover:bg-red-500 hover:text-white transition-all font-bold"><LogOut size={20}/> 登出系統</button>
        </div>
      </aside>

      <main className="flex-1 ml-72 p-12 h-screen overflow-y-auto">
        <header className="flex justify-between items-end mb-12 no-print">
          <div><h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter">{activeTab === 'stickers' ? '今日營運總覽' : activeTab === 'settings' ? '系統選項設定' : activeTab}</h2><div className="h-1.5 w-24 bg-orange-500 rounded-full mt-4"></div></div>
          <div className="flex gap-4 items-center">
            {(activeTab === 'stickers') && (
              <button onClick={exportKitchenExcel} className="bg-emerald-600 text-white p-3 px-6 rounded-2xl font-black shadow-lg flex gap-2 items-center hover:bg-emerald-700 active:scale-95 transition-all"><Download size={18}/> 導出廚房總表</button>
            )}
            <div className="bg-white p-2 rounded-2xl shadow-sm border flex items-center gap-2">
              <CalendarIcon size={18} className="ml-3 text-slate-400"/><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="p-3 font-black outline-none bg-transparent cursor-pointer" />
            </div>
          </div>
        </header>

        {activeTab === 'customers' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="relative max-w-xl"><Search className="absolute left-6 top-6 text-slate-300" size={20} /><input placeholder="搜尋姓名、地址、編號或機構..." className="w-full pl-16 pr-8 py-6 rounded-[2rem] shadow-sm border-none outline-none focus:ring-4 focus:ring-orange-500/10 font-bold text-lg transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {customers.filter(c => c.name.includes(searchTerm) || c.institution.includes(searchTerm) || c.id.includes(searchTerm)).map(c => (
                <div key={c.id} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group flex flex-col h-full">
                  <div className="flex justify-between items-start mb-6"><span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${c.type === 'CCSV 客戶' ? 'bg-blue-50 text-blue-500' : c.type === '團體單' ? 'bg-orange-50 text-orange-500' : 'bg-slate-100 text-slate-400'}`}>{c.type}</span><button onClick={() => setSelectedCustomer(c)} className="p-3 bg-orange-50 text-orange-500 rounded-2xl group-hover:bg-orange-500 group-hover:text-white transition-all"><CalendarIcon size={20}/></button></div>
                  <h4 className="text-2xl font-black text-slate-800 leading-tight">{c.name}</h4>
                  <div className="mt-2 flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest"><Building2 size={12}/> {c.institution || "獨立個人"}</div>
                  <p className="text-xs text-slate-400 mt-6 leading-relaxed grow line-clamp-2"><MapPin size={12} className="inline mr-2"/>{c.address}</p>
                  <div className="mt-8 flex gap-3 pt-6 border-t border-slate-50">
                    <button onClick={() => setSelectedCustomer(c)} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-orange-600 transition-all shadow-lg active:scale-95">全月點餐月曆</button>
                    <button onClick={() => setEditingCustomer(c)} className="p-4 border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 hover:border-slate-900 transition-all shadow-sm bg-white" title="修改或刪除客戶"><Edit2 size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 🆕 系統選項設定 Tab */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-2 gap-8 animate-in fade-in duration-500">
            {/* 路線設定 */}
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
              <h3 className="text-2xl font-black mb-6">派送路線設定</h3>
              <div className="flex gap-2 mb-6">
                <input id="newZoneInput" placeholder="輸入新路線名稱..." className="flex-1 bg-slate-50 p-4 rounded-2xl font-bold outline-none" />
                <button onClick={async () => {
                  const val = document.getElementById('newZoneInput').value.trim();
                  if (val && !sysSettings.zones.includes(val)) {
                    const newZones = [...sysSettings.zones, val];
                    await setDoc(doc(db, 'settings', 'options'), { ...sysSettings, zones: newZones });
                    document.getElementById('newZoneInput').value = '';
                  }
                }} className="bg-slate-900 text-white px-6 rounded-2xl font-black hover:bg-orange-500 transition-all"><Plus size={20}/></button>
              </div>
              <div className="space-y-2">
                {sysSettings.zones.map(z => (
                  <div key={z} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl font-bold">
                    <span>{z}</span>
                    <button onClick={async () => {
                      if(window.confirm(`確定刪除路線「${z}」？`)) {
                        const newZones = sysSettings.zones.filter(item => item !== z);
                        await setDoc(doc(db, 'settings', 'options'), { ...sysSettings, zones: newZones });
                      }
                    }} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                  </div>
                ))}
              </div>
            </div>

            {/* 機構設定 */}
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
              <h3 className="text-2xl font-black mb-6">CCSV 機構選項設定</h3>
              <div className="flex gap-2 mb-6">
                <input id="newInstInput" placeholder="輸入新機構名稱..." className="flex-1 bg-slate-50 p-4 rounded-2xl font-bold outline-none" />
                <button onClick={async () => {
                  const val = document.getElementById('newInstInput').value.trim();
                  if (val && !sysSettings.institutions.includes(val)) {
                    const newInst = [...sysSettings.institutions, val];
                    await setDoc(doc(db, 'settings', 'options'), { ...sysSettings, institutions: newInst });
                    document.getElementById('newInstInput').value = '';
                  }
                }} className="bg-slate-900 text-white px-6 rounded-2xl font-black hover:bg-orange-500 transition-all"><Plus size={20}/></button>
              </div>
              <div className="space-y-2">
                {sysSettings.institutions.map(inst => (
                  <div key={inst} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl font-bold">
                    <span>{inst}</span>
                    <button onClick={async () => {
                      if(window.confirm(`確定刪除機構「${inst}」？`)) {
                        const newInst = sysSettings.institutions.filter(item => item !== inst);
                        await setDoc(doc(db, 'settings', 'options'), { ...sysSettings, institutions: newInst });
                      }
                    }} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Import Tabs... (Skipped changes here, logic remains identical) */}
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

        {activeTab === 'stickers' && (
          <div className="space-y-8 no-print animate-in fade-in duration-500">
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-6">
               <div className="flex items-center justify-between mb-2">
                 <div><h4 className="font-black text-3xl text-slate-800 tracking-tighter">今日出餐總計</h4><p className="text-xs text-slate-400 font-bold uppercase mt-1">Daily Meal Summary</p></div>
                 <button onClick={() => window.print()} className="bg-orange-500 text-white px-10 py-5 rounded-2xl font-black shadow-lg active:scale-95">列印所有出餐貼紙</button>
               </div>
               
               <div className="grid grid-cols-4 gap-6">
                 {MEALS.map(m => (
                   <div key={m} className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                     <div className="font-black text-xl text-slate-700 mb-4 pb-4 border-b border-slate-200">{m}餐 <span className="text-orange-500 ml-2">共 {dailySummary[m].total} 份</span></div>
                     <div className="space-y-2">
                       {TEXTURES.map(t => dailySummary[m][t] > 0 && (
                         <div key={t} className="flex justify-between items-center text-sm font-bold text-slate-600"><span>{t}</span><span className="bg-white px-3 py-1 rounded-lg border">{dailySummary[m][t]}</span></div>
                       ))}
                     </div>
                   </div>
                 ))}
                 <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex flex-col justify-center items-center text-center">
                   <div className="font-black text-xl text-emerald-800 mb-2">例湯總數</div>
                   <div className="text-6xl font-black text-emerald-500">{dailySummary.Soup}</div>
                 </div>
               </div>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                {orders.map(o => {
                  const c = customers.find(cust => cust.id === o.customerId);
                  if(!c) return null;
                  const totalCounts = Object.values(o.counts || {}).reduce((a, b) => a + b, 0);
                  const soupCounts = parseInt(o.soupQty) || 0; // 🆕 用手動輸入嘅餐湯
                  if(totalCounts === 0 && soupCounts === 0) return null;

                  return (
                    <div key={o.customerId} className="bg-white border-2 border-black p-6 h-[320px] relative flex flex-col font-bold break-inside-avoid">
                       <div className="text-center border-b-2 border-black pb-2 mb-2"><div className="text-3xl font-black tracking-tighter uppercase">{c.name}</div><div className="text-[10px] uppercase">{c.zone}</div></div>
                       <div className="text-xs mb-4 h-10 overflow-hidden">{c.address}</div>
                       <div className="flex-1 space-y-1">
                          {Object.keys(o.counts || {}).map(k => o.counts[k] > 0 && (
                            <div key={k} className="flex justify-between border-b border-black/10 py-1">
                              <span>({k.split('_')[0]}餐-{k.split('_')[1]}) {(menus[selectedDate] || {})[k.split('_')[0]]}</span>
                              <span className="font-black text-lg">x {o.counts[k]}</span>
                            </div>
                          ))}
                          {soupCounts > 0 && (
                             <div className="flex justify-between py-1 border-b border-black/10 text-emerald-700">
                               <span>今日例湯: {(menus[selectedDate] || {}).Soup}</span>
                               <span className="font-black text-lg">x {soupCounts}</span>
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

        {/* 🆕 月度對數 Tab (大升級：顯示機構下嘅每一張團體單) */}
        {activeTab === 'recon' && (
          <div className="bg-white rounded-[3rem] shadow-sm border overflow-hidden animate-in fade-in duration-500">
            <div className="p-10 border-b flex justify-between items-center bg-slate-50/50">
               <div><h3 className="font-black text-2xl tracking-tighter">機構對數月度彙報 (含團體單)</h3><p className="text-[10px] text-slate-400 font-black uppercase mt-2 tracking-widest">目前顯示月份：{selectedDate.substring(0, 7)}</p></div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-slate-400 text-[10px] uppercase font-black tracking-widest">
                  <th className="p-6 text-left">對數機構 / 團體單名稱</th>
                  <th className="p-6 text-center">當月餐數</th>
                  <th className="p-6 text-center">當月例湯</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold">
                {monthlyReconciliationData.map(r => (
                  <React.Fragment key={r.name}>
                    {/* 機構總數 */}
                    <tr className="bg-orange-50/50 hover:bg-orange-50 transition-colors">
                      <td className="p-6 text-lg font-black text-slate-800">🏢 {r.name} <span className="text-xs text-orange-500 ml-2">(全月總計)</span></td>
                      <td className="p-6 text-center text-xl font-black text-slate-900">{r.totalMeals}</td>
                      <td className="p-6 text-center text-xl font-black text-emerald-600">{r.totalSoup}</td>
                    </tr>
                    {/* 該機構旗下嘅個別客戶 / 團體單 */}
                    {Object.values(r.groups).map(g => (
                      <tr key={g.name} className="hover:bg-slate-50 transition-colors text-slate-600">
                        <td className="p-4 pl-14 border-l-4 border-orange-200">↳ {g.name} <span className="ml-2 px-2 py-0.5 bg-slate-100 text-[9px] rounded-full">{g.type}</span></td>
                        <td className="p-4 text-center">{g.meals}</td>
                        <td className="p-4 text-center">{g.soup}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                {monthlyReconciliationData.length === 0 && (
                  <tr><td colSpan="3" className="p-10 text-center text-slate-400">此月份暫無訂單數據</td></tr>
                )}
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
