import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, ClipboardList, FileSpreadsheet, ChefHat, 
  Upload, Search, Plus, Download, Edit2, Check, X, Calendar as CalendarIcon, 
  Soup, ArrowLeft, ArrowRight, Trash2, MapPin, Building2, BarChart3, LogOut, Lock, Settings, BookOpen 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, doc, setDoc, query, where, getDocs, deleteDoc 
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';

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
const RICE_TEXTURES = ['正飯', '爛飯', '粥', '無需飯']; // 🆕 定義飯類組合
const MEALS = ['A', 'B', 'C'];
const CUST_TYPES = ['B2C 普通個人', 'B2C CCSV 客戶', 'B2B 院舍', 'B2B 團體單'];

const BlogEditModal = ({ blog, onClose, db }) => {
  const [form, setForm] = useState(blog || { title: '', category: '節氣養生', date: new Date().toISOString().split('T')[0], summary: '', content: '' });
  
  const handleSave = async () => {
    if (!form.title || !form.content) return alert("標題同內容唔可以留空！");
    try {
      const docRef = form.id ? doc(db, 'blogs', form.id) : doc(collection(db, 'blogs'));
      await setDoc(docRef, form, { merge: true });
      alert("文章儲存成功！"); onClose();
    } catch (err) { alert("儲存失敗：" + err.message); }
  };

  const handleDelete = async () => {
    if (window.confirm(`確定要刪除文章「${form.title}」？`)) {
      await deleteDoc(doc(db, 'blogs', form.id)); onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-2xl">
         <div className="p-8 border-b flex justify-between items-center bg-slate-50"><h3 className="text-2xl font-black">{form.id ? '編輯文章' : '新增健康資訊'}</h3><button onClick={onClose} className="p-3 bg-slate-200 rounded-xl hover:bg-slate-300"><X size={20}/></button></div>
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">標題</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" /></div>
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">分類</label><input value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" /></div>
          </div>
          <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">簡介</label><input value={form.summary} onChange={e => setForm({...form, summary: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" /></div>
          <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">詳細內容</label><textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold min-h-[200px] resize-none"></textarea></div>
        </div>
        <div className="p-8 border-t bg-slate-50 flex justify-between items-center">
          {form.id ? <button onClick={handleDelete} className="text-red-500 font-black hover:bg-red-100 px-4 py-2 rounded-xl flex items-center gap-2"><Trash2 size={18}/> 刪除文章</button> : <div></div>}
          <div className="flex gap-3"><button onClick={onClose} className="font-black text-slate-400 px-6">取消</button><button onClick={handleSave} className="bg-slate-900 text-white font-black px-8 py-4 rounded-2xl shadow-lg flex items-center gap-2"><Check size={18}/> 儲存發佈</button></div>
        </div>
      </div>
    </div>
  );
};

const CustomerEditModal = ({ customer, onClose, db, sysSettings }) => {
  const [form, setForm] = useState(customer);
  const handleSave = async () => { try { await setDoc(doc(db, 'customers', customer.id), form, { merge: true }); alert("資料已更新！"); onClose(); } catch (err) { alert("更新失敗：" + err.message); } };
  const handleDelete = async () => { if (window.confirm(`⚠️ 警告：確定要永久刪除客戶「${customer.name}」嗎？`)) { await deleteDoc(doc(db, 'customers', customer.id)); alert("客戶資料已徹底刪除。"); onClose(); } };

  return (
    <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-2xl">
        <div className="p-8 border-b flex justify-between items-center bg-slate-50"><div><h3 className="text-2xl font-black">修改客戶資料</h3><p className="text-xs font-bold text-slate-400 mt-1">ID: {customer.id}</p></div><button onClick={onClose} className="p-3 bg-slate-200 rounded-xl hover:bg-slate-300"><X size={20}/></button></div>
        <div className="p-8 grid grid-cols-2 gap-6">
          <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">姓名</label><input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" /></div>
          <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">電話</label><input value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" /></div>
          <div className="space-y-2 col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">地址</label><input value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" /></div>
          <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">線路</label><select value={form.zone || ''} onChange={e => setForm({...form, zone: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"><option value="">請選擇...</option>{(sysSettings?.zones || []).map(z => <option key={z} value={z}>{z}</option>)}</select></div>
          <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">機構</label><select value={form.institution || ''} onChange={e => setForm({...form, institution: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"><option value="">獨立個人</option>{(sysSettings?.institutions || []).map(inst => <option key={inst} value={inst}>{inst}</option>)}</select></div>
          <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">客戶類型</label><select value={form.type || ''} onChange={e => setForm({...form, type: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"><option value="">請選擇...</option>{CUST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div className="space-y-2 col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">特別要求</label><input value={form.requirement || ''} onChange={e => setForm({...form, requirement: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" /></div>
          <div className="space-y-2 col-span-2 flex gap-6 p-4 bg-slate-50 rounded-2xl">
            <label className="flex items-center gap-3 cursor-pointer font-bold"><input type="checkbox" checked={form.needsUtensils || false} onChange={e => setForm({...form, needsUtensils: e.target.checked})} className="w-5 h-5 accent-orange-500 cursor-pointer" />需要餐具 🍴</label>
            <label className="flex items-center gap-3 cursor-pointer font-bold"><input type="checkbox" checked={form.needsMenu || false} onChange={e => setForm({...form, needsMenu: e.target.checked})} className="w-5 h-5 accent-orange-500 cursor-pointer" />附菜單 📄</label>
          </div>
        </div>
        <div className="p-8 border-t bg-slate-50 flex justify-between items-center"><button onClick={handleDelete} className="text-red-500 font-black hover:bg-red-100 p-4 rounded-2xl flex gap-2"><Trash2 size={18}/> 刪除</button><div className="flex gap-3"><button onClick={onClose} className="font-black text-slate-400 px-6">取消</button><button onClick={handleSave} className="bg-slate-900 text-white font-black px-8 py-4 rounded-2xl shadow-lg flex gap-2"><Check size={18}/> 儲存</button></div></div>
      </div>
    </div>
  );
};

const CustomerCalendar = ({ customer, currentMonth, setCurrentMonth, currentYear, menus, onClose, db }) => {
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
  }, [customer.id, currentMonth, currentYear, db]);

  return (
    <div className="fixed inset-0 bg-slate-900/95 z-50 flex items-center justify-center p-2">
      <div className="bg-white rounded-[2rem] w-full max-w-[98vw] h-[98vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
          <div><h3 className="text-4xl font-black text-slate-800">{customer.name} - 點餐明細</h3><p className="text-sm text-slate-500 font-bold mt-2">{currentYear}年 {currentMonth + 1}月 | 機構: {customer.institution || '獨立個人'}</p></div>
          <div className="flex gap-3"><button onClick={() => setCurrentMonth(m => m === 0 ? 11 : m - 1)} className="p-4 border-2 rounded-2xl bg-white"><ArrowLeft size={24}/></button><button onClick={() => setCurrentMonth(m => m === 11 ? 0 : m + 1)} className="p-4 border-2 rounded-2xl bg-white"><ArrowRight size={24}/></button><button onClick={onClose} className="ml-6 p-4 bg-red-500 text-white rounded-2xl shadow-lg"><X size={24}/></button></div>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-slate-100/50">
          <div className="grid grid-cols-7 gap-3">
            {['日','一','二','三','四','五','六'].map(d => (<div key={d} className="text-center text-sm font-black text-slate-400 uppercase py-2 tracking-widest">{d}</div>))}
            {[...Array(new Date(currentYear, currentMonth, 1).getDay())].map((_, i) => <div key={`empty-${i}`} />)}
            {[...Array(daysInMonth)].map((_, i) => {
              const day = i + 1;
              const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const order = monthOrders.find(o => o.date === dateStr) || { counts: {}, soupQty: 0, fruitQty: 0 };
              const total = Object.values(order.counts || {}).reduce((a, b) => a + b, 0) + (parseInt(order.soupQty) || 0) + (parseInt(order.fruitQty) || 0);

              return (
                <div key={day} className={`border-2 rounded-[1.5rem] p-4 flex flex-col gap-3 min-h-[320px] transition-all ${total > 0 ? 'bg-white border-orange-300 shadow-xl' : 'bg-slate-50/80 border-slate-200'}`}>
                  <div className="flex flex-wrap justify-between items-center mb-2 gap-2">
                    <span className="text-3xl font-black text-slate-700">{day}{order.referralCode && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full ml-2 align-middle border border-yellow-300">碼: {order.referralCode}</span>}</span>
                  </div>
                  <div className="space-y-2 flex-1 text-sm font-bold text-slate-600">
                    {/* 直接展示組合，因為後台已不需負責入飛編輯 */}
                    {Object.keys(order.counts || {}).map(k => (
                       <div key={k} className="bg-slate-50 p-2 rounded-xl border border-slate-100">{k.replace(/_/g, ' + ')} x {order.counts[k]}</div>
                    ))}
                    {order.soupQty > 0 && <div className="bg-emerald-50 text-emerald-700 p-2 rounded-xl border border-emerald-100">例湯 x {order.soupQty}</div>}
                    {order.fruitQty > 0 && <div className="bg-rose-50 text-rose-700 p-2 rounded-xl border border-rose-100">生果 x {order.fruitQty}</div>}
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
  const [monthlyOrders, setMonthlyOrders] = useState([]); 
  const [menus, setMenus] = useState({});
  const [sysSettings, setSysSettings] = useState({ zones: [], institutions: [] });

  const [dishes, setDishes] = useState({});
  const [blogs, setBlogs] = useState([]);
  const [editingBlog, setEditingBlog] = useState(null);

  const [selectedCustomer, setSelectedCustomer] = useState(null); 
  const [editingCustomer, setEditingCustomer] = useState(null); 
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); 
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setIsAuthChecking(false); });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault(); setLoginError('');
    try { await signInWithEmailAndPassword(auth, loginEmail, loginPassword); } 
    catch (error) { setLoginError("登入失敗：請檢查電郵地址或密碼是否正確。"); }
  };
  const handleLogout = async () => { if (window.confirm("確定要登出系統嗎？")) await signOut(auth); };

  useEffect(() => {
    if (!user) return;
    const unsubCust = onSnapshot(collection(db, 'customers'), (snap) => setCustomers(snap.docs.map(d => d.data()).sort((a,b) => String(a.id).localeCompare(String(b.id)))));
    const unsubMenu = onSnapshot(collection(db, 'menus'), (snap) => { const mObj = {}; snap.docs.forEach(d => mObj[d.id] = d.data()); setMenus(mObj); });
    const qOrders = query(collection(db, 'orders'), where("date", "==", selectedDate));
    const unsubOrders = onSnapshot(qOrders, (snap) => setOrders(snap.docs.map(d => d.data())));
    const unsubSettings = onSnapshot(doc(db, 'settings', 'options'), (docSnap) => { if (docSnap.exists()) setSysSettings(prev => ({ ...prev, ...docSnap.data() })); });
    const unsubDishes = onSnapshot(collection(db, 'dishes'), (snap) => { const dObj = {}; snap.docs.forEach(d => dObj[d.id] = d.data()); setDishes(dObj); });
    const unsubBlogs = onSnapshot(collection(db, 'blogs'), (snap) => setBlogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubCust(); unsubMenu(); unsubOrders(); unsubSettings(); unsubDishes(); unsubBlogs(); };
  }, [user, selectedDate]);

  useEffect(() => {
    if (!user) return;
    const monthPrefix = selectedDate.substring(0, 7); 
    const qMonth = query(collection(db, 'orders'), where("date", ">=", `${monthPrefix}-01`), where("date", "<=", `${monthPrefix}-31`));
    const unsubMonthly = onSnapshot(qMonth, (snap) => setMonthlyOrders(snap.docs.map(d => d.data())));
    return () => unsubMonthly();
  }, [user, selectedDate]);

  // ==========================================
  // 🆕 母子 SKU 自動生成系統 (Parent -> Variations)
  // ==========================================
  const processDish = async (dishName) => {
    if (!dishName || dishName.trim() === '') return null;
    const cleanName = dishName.trim();
    const safeDocId = cleanName.replace(/\//g, '或'); 
    const dishRef = doc(db, 'dishes', safeDocId);
    const dishSnap = await getDocs(query(collection(db, 'dishes'), where("name", "==", cleanName)));
    
    if (!dishSnap.empty) return dishSnap.docs[0].data();
    else {
      // 生成 Parent 大 SKU
      const baseSku = 'D-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // 生成 Variation 組合獨立子 SKU
      const variations = {};
      let vCount = 1;
      TEXTURES.forEach(meat => {
        RICE_TEXTURES.forEach(rice => {
          variations[`${meat}_${rice}`] = `${baseSku}-V${String(vCount).padStart(2, '0')}`;
          vCount++;
        });
      });

      const newDishData = { 
        name: cleanName, 
        sku: baseSku, 
        variations: variations, // 儲存所有子 SKU
        nutrition: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, 
        createdAt: new Date().toISOString() 
      };
      await setDoc(dishRef, newDishData);
      return newDishData;
    }
  };

  const handleMenuImport = async (e) => {
    const file = e.target.files[0];
    if (!file || !window.XLSX) return alert("請確保已載入 XLSX 庫");
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataBuffer = new Uint8Array(evt.target.result);
        const wb = window.XLSX.read(dataBuffer, { type: 'array' });
        const data = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        for (let row of data) {
          const keys = Object.keys(row);
          const dateKey = keys.find(k => k.includes('日期') || k.includes('Date') || k.includes('date'));
          if (!dateKey || !row[dateKey]) continue;
          let dateStr = row[dateKey];
          if (typeof dateStr === 'number') {
            const d = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
            dateStr = d.toISOString().split('T')[0];
          } else { dateStr = String(dateStr).trim().replace(/\//g, '-'); }

          const menuA = String(row[keys.find(k => k.includes('A餐') || k === 'A')] || "").trim();
          const menuB = String(row[keys.find(k => k.includes('B餐') || k === 'B')] || "").trim();
          const menuC = String(row[keys.find(k => k.includes('C餐') || k === 'C')] || "").trim();

          if (menuA) await processDish(menuA);
          if (menuB) await processDish(menuB);
          if (menuC) await processDish(menuC);

          await setDoc(doc(db, 'menus', dateStr), { date: dateStr, A: menuA, B: menuB, C: menuC }, { merge: true });
        }
        alert("每月餐單及菜品母子 SKU 庫同步導入成功！");
      } catch (err) { alert("導入出錯：" + err.message); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCustImport = async (e) => { /* 保持原樣 */ };
  const handleMassImportOrders = async (e) => { /* 保持原樣 */ };

  // ==========================================
  // 🆕 營運總覽統計 (按照組合計算及顯示子 SKU)
  // ==========================================
  const dailyCombinationSummary = useMemo(() => {
    // 按餐類 > 菜名 > 組合 進行分類
    const summary = { A: { items: {}, total: 0 }, B: { items: {}, total: 0 }, C: { items: {}, total: 0 }, Special: { items: {}, total: 0 }, Soup: 0, Fruit: 0 };
    
    const todayMenu = menus[selectedDate] || {};

    orders.forEach(o => {
      Object.keys(o.counts || {}).forEach(k => {
        const qty = parseInt(o.counts[k]) || 0;
        if (qty > 0) {
          const parts = k.split('_');
          const meal = parts[0];       
          const meatTex = parts[1];    
          const riceTex = parts[2] || '正飯'; // 預設正飯
          
          if (meal === '特別餐') {
            const specName = `${parts[1]}`;
            const tex = parts[2] || '正';
            const combKey = `${tex}`;
            if (!summary.Special.items[specName]) summary.Special.items[specName] = { total: 0, combinations: {} };
            summary.Special.items[specName].combinations[combKey] = (summary.Special.items[specName].combinations[combKey] || 0) + qty;
            summary.Special.items[specName].total += qty;
            summary.Special.total += qty;
          } else if (['A', 'B', 'C'].includes(meal)) {
            const dishName = todayMenu[meal] || '未設定菜式';
            const combKey = `${meatTex}_${riceTex}`;
            if (!summary[meal].items[dishName]) summary[meal].items[dishName] = { total: 0, combinations: {} };
            summary[meal].items[dishName].combinations[combKey] = (summary[meal].items[dishName].combinations[combKey] || 0) + qty;
            summary[meal].items[dishName].total += qty;
            summary[meal].total += qty;
          }
        }
      });
      summary.Soup += (parseInt(o.soupQty) || 0);
      summary.Fruit += (parseInt(o.fruitQty) || 0);
    });
    return summary;
  }, [orders, menus, selectedDate]);

  // 月度對數 (保持原樣)
  const monthlyReconciliationData = useMemo(() => {
    const report = {};
    monthlyOrders.forEach(o => {
      const cust = customers.find(c => c.id === o.customerId);
      if (!cust) return;
      const groupKey = cust.institution || "獨立個人客戶";
      if (!report[groupKey]) report[groupKey] = { name: groupKey, A: 0, B: 0, C: 0, paste: 0, minced: 0, Special: 0, Soup: 0, Fruit: 0, totalMeals: 0, groups: {} };
      if (!report[groupKey].groups[cust.id]) report[groupKey].groups[cust.id] = { name: cust.name, type: cust.type, A: 0, B: 0, C: 0, paste: 0, minced: 0, Special: 0, Soup: 0, Fruit: 0, total: 0 };
      
      let totalMealsForOrder = 0;
      Object.keys(o.counts || {}).forEach(k => {
        const qty = parseInt(o.counts[k]) || 0;
        if (qty > 0) {
          const parts = k.split('_');
          const mealType = parts[0];
          const texture = parts[1]; // A_正_爛飯 -> texture='正'
          
          if (mealType === '特別餐') { report[groupKey].Special += qty; report[groupKey].groups[cust.id].Special += qty; } 
          else if (['A', 'B', 'C'].includes(mealType)) { report[groupKey][mealType] += qty; report[groupKey].groups[cust.id][mealType] += qty; }

          if (['分糊', '全糊'].includes(texture)) { report[groupKey].paste += qty; report[groupKey].groups[cust.id].paste += qty; }
          if (texture === '免治') { report[groupKey].minced += qty; report[groupKey].groups[cust.id].minced += qty; }
          totalMealsForOrder += qty;
        }
      });
      const soupQty = parseInt(o.soupQty) || 0; const fruitQty = parseInt(o.fruitQty) || 0;
      report[groupKey].totalMeals += totalMealsForOrder; report[groupKey].Soup += soupQty; report[groupKey].Fruit += fruitQty;
      report[groupKey].groups[cust.id].total += totalMealsForOrder; report[groupKey].groups[cust.id].Soup += soupQty; report[groupKey].groups[cust.id].Fruit += fruitQty;
    });
    return Object.values(report).sort((a,b) => b.totalMeals - a.totalMeals);
  }, [monthlyOrders, customers]);

  if (initError) return <div className="p-10 font-bold text-red-500">{initError}</div>;
  if (isAuthChecking) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400">系統載入中...</div>;
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-3 bg-orange-500"></div>
          <div className="flex flex-col items-center mb-10"><div className="w-24 h-24 bg-slate-50 rounded-3xl p-2 mb-6 flex items-center justify-center shadow-inner"><img src="/logo.png" alt="WeCare" className="w-full h-full object-contain" /></div><h1 className="text-4xl font-black italic text-slate-900 tracking-tighter">WECARE</h1></div>
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

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <aside className="w-72 bg-slate-900 text-white p-8 no-print fixed h-full z-20 flex flex-col">
        <div className="flex items-center gap-4 mb-12"><div className="w-14 h-14 bg-white rounded-2xl p-1 overflow-hidden flex items-center justify-center shadow-inner"><img src="/logo.png" alt="WeCare" className="w-full h-full object-contain" /></div><div><h1 className="text-2xl font-black italic text-orange-500 tracking-tighter leading-none">WECARE</h1><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Operations Pro</p></div></div>
        <nav className="flex-1 space-y-2">
          <button onClick={() => setActiveTab('customers')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'customers' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Users size={20}/> 客戶資料管理</button>
          <button onClick={() => setActiveTab('add')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'add' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Plus size={20}/> 新增/批量導入</button>
          <button onClick={() => setActiveTab('menu')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'menu' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><ChefHat size={20}/> 每月餐單一覽</button>
          <button onClick={() => setActiveTab('dishes')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'dishes' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Soup size={20}/> 母子 SKU 數據庫</button>
          <button onClick={() => setActiveTab('daily')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'daily' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><ClipboardList size={20}/> 今日營運總覽</button>
          <button onClick={() => setActiveTab('recon')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'recon' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><BarChart3 size={20}/> 月度機構對數</button>
          <button onClick={() => setActiveTab('blogs')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'blogs' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><BookOpen size={20}/> 健康資訊 (Blog)</button>
          <button onClick={() => setActiveTab('settings')} className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 ${activeTab === 'settings' ? 'bg-orange-500 shadow-lg font-bold text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Settings size={20}/> 系統選項設定</button>
        </nav>
        <div className="pt-6 border-t border-slate-800 mt-auto"><div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3 ml-2">使用者: {user?.email}</div><button onClick={handleLogout} className="w-full text-left p-4 rounded-2xl flex items-center gap-4 text-red-400 hover:bg-red-500 hover:text-white transition-all font-bold"><LogOut size={20}/> 登出系統</button></div>
      </aside>

      <main className="flex-1 ml-72 p-12 h-screen overflow-y-auto">
        <header className="flex justify-between items-end mb-12 no-print">
          <div><h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter">
            {activeTab === 'daily' ? '今日營運總覽' : activeTab === 'settings' ? '系統選項設定' : activeTab === 'dishes' ? '菜品與營養數據庫' : activeTab}
          </h2><div className="h-1.5 w-24 bg-orange-500 rounded-full mt-4"></div></div>
          <div className="flex gap-4 items-center">
            <div className="bg-white p-2 rounded-2xl shadow-sm border flex items-center gap-2">
              <CalendarIcon size={18} className="ml-3 text-slate-400"/><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="p-3 font-black outline-none bg-transparent cursor-pointer" />
            </div>
          </div>
        </header>

        {activeTab === 'customers' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="relative max-w-xl"><Search className="absolute left-6 top-6 text-slate-300" size={20} /><input placeholder="搜尋姓名、電話或機構..." className="w-full pl-16 pr-8 py-6 rounded-[2rem] shadow-sm border-none outline-none focus:ring-4 focus:ring-orange-500/10 font-bold text-lg transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {customers.filter(c => c.name.includes(searchTerm) || c.institution.includes(searchTerm) || c.id.includes(searchTerm) || (c.phone && c.phone.includes(searchTerm))).map(c => (
                <div key={c.id} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group flex flex-col h-full">
                  <div className="flex justify-between items-start mb-6"><span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${c.type?.includes('B2B') ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'}`}>{c.type || 'B2C 普通個人'}</span><button onClick={() => setSelectedCustomer(c)} className="p-3 bg-orange-50 text-orange-500 rounded-2xl group-hover:bg-orange-500 group-hover:text-white transition-all"><CalendarIcon size={20}/></button></div>
                  <h4 className="text-2xl font-black text-slate-800 leading-tight">{c.name}</h4>
                  <div className="mt-2 flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest"><Building2 size={12}/> {c.institution || "獨立個人"} | 📞 {c.phone}</div>
                  <p className="text-xs text-slate-400 mt-6 leading-relaxed grow line-clamp-2"><MapPin size={12} className="inline mr-2"/>{c.address}</p>
                  <div className="mt-6 flex gap-3 pt-6 border-t border-slate-50"><button onClick={() => setSelectedCustomer(c)} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-orange-600 transition-all shadow-lg active:scale-95">全月點餐月曆</button><button onClick={() => setEditingCustomer(c)} className="p-4 border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 hover:border-slate-900 transition-all shadow-sm bg-white"><Edit2 size={18}/></button></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 🆕 每月餐單匯入 (直觀表格版) */}
        {activeTab === 'menu' && (() => {
          const year = parseInt(selectedDate.substring(0, 4));
          const month = parseInt(selectedDate.substring(5, 7));
          const daysInMonth = new Date(year, month, 0).getDate();
          
          const monthMenuData = [];
          for(let i = 1; i <= daysInMonth; i++) {
             const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
             const dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][new Date(year, month-1, i).getDay()];
             monthMenuData.push({ dateStr, dayOfWeek, ...menus[dateStr] });
          }

          return (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                <div><h3 className="text-2xl font-black text-slate-800 tracking-tighter">每月餐單一覽</h3><p className="text-sm text-slate-400 font-bold mt-1 uppercase tracking-widest">目前顯示：{year}年 {month}月</p></div>
                <label className="bg-orange-500 text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-orange-600 transition-all cursor-pointer flex items-center gap-2 active:scale-95"><Upload size={18}/> 匯入 Excel 餐單<input type="file" onChange={handleMenuImport} className="hidden" /></label>
              </div>

              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50"><tr className="border-b-2 border-slate-100 text-slate-400 text-[10px] uppercase font-black tracking-widest"><th className="p-5 w-40 pl-8 rounded-tl-[2rem]">日期</th><th className="p-5 w-1/4">A餐</th><th className="p-5 w-1/4">B餐</th><th className="p-5 w-1/4 rounded-tr-[2rem]">C餐</th></tr></thead>
                    <tbody className="divide-y divide-slate-50 font-bold text-sm text-slate-700">
                       {monthMenuData.map(day => {
                         const isSunday = day.dayOfWeek === '日';
                         return (
                           <tr key={day.dateStr} className={`hover:bg-orange-50/30 transition-colors ${isSunday ? 'bg-slate-50/80 text-slate-400' : ''}`}>
                             <td className="p-5 pl-8 flex items-center gap-3"><span className={`text-xl font-black ${isSunday ? 'text-slate-400' : 'text-slate-800'}`}>{day.dateStr.substring(8, 10)}</span><span className={`text-[10px] px-2 py-1 rounded-md font-black ${isSunday ? 'bg-red-100 text-red-500' : 'bg-slate-200 text-slate-600'}`}>星期{day.dayOfWeek}</span></td>
                             <td className={`p-5 ${day.A ? 'text-orange-600' : 'text-slate-300'}`}>{day.A || '未設定'}</td><td className={`p-5 ${day.B ? 'text-blue-600' : 'text-slate-300'}`}>{day.B || '未設定'}</td><td className={`p-5 ${day.C ? 'text-emerald-600' : 'text-slate-300'}`}>{day.C || '未設定'}</td>
                           </tr>
                         );
                       })}
                    </tbody>
                 </table>
              </div>
            </div>
          );
        })()}

        {/* 🆕 菜品庫 (顯示 Parent SKU) */}
        {activeTab === 'dishes' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
              <h3 className="text-2xl font-black mb-2 text-slate-800 tracking-tighter">菜式大 SKU 數據庫</h3>
              <p className="text-sm font-bold text-slate-400 mb-6">母 SKU 會自動衍生 20 個獨立子組合 SKU (正/碎/免治/糊 × 飯類)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50"><tr className="border-b-2 border-slate-100 text-slate-400 text-[10px] uppercase font-black tracking-widest"><th className="p-4 rounded-tl-xl">母 SKU 代碼</th><th className="p-4">菜式名稱</th><th className="p-4 text-center">卡路里 (kcal)</th><th className="p-4 text-center">蛋白質 (g)</th><th className="p-4 text-center">碳水 (g)</th><th className="p-4 text-center rounded-tr-xl">脂肪 (g)</th></tr></thead>
                  <tbody className="divide-y divide-slate-50 font-bold text-sm text-slate-700">
                    {Object.values(dishes).map((dish) => {
                      const safeDocId = dish.name.replace(/\//g, '或');
                      return (
                        <tr key={dish.sku} className="hover:bg-orange-50/30 transition-colors">
                          <td className="p-4 text-orange-500 font-black tracking-widest">{dish.sku}</td><td className="p-4 text-base">{dish.name}</td>
                          <td className="p-4 text-center"><input type="number" defaultValue={dish.nutrition?.kcal || 0} onBlur={(e) => setDoc(doc(db, 'dishes', safeDocId), { nutrition: { ...dish.nutrition, kcal: Number(e.target.value) } }, { merge: true })} className="w-20 p-2 bg-slate-50 border-none rounded-lg text-center outline-none focus:ring-2 focus:ring-orange-500 font-black" /></td>
                          <td className="p-4 text-center"><input type="number" defaultValue={dish.nutrition?.protein || 0} onBlur={(e) => setDoc(doc(db, 'dishes', safeDocId), { nutrition: { ...dish.nutrition, protein: Number(e.target.value) } }, { merge: true })} className="w-20 p-2 bg-slate-50 border-none rounded-lg text-center outline-none focus:ring-2 focus:ring-orange-500 font-black" /></td>
                          <td className="p-4 text-center"><input type="number" defaultValue={dish.nutrition?.carbs || 0} onBlur={(e) => setDoc(doc(db, 'dishes', safeDocId), { nutrition: { ...dish.nutrition, carbs: Number(e.target.value) } }, { merge: true })} className="w-20 p-2 bg-slate-50 border-none rounded-lg text-center outline-none focus:ring-2 focus:ring-orange-500 font-black" /></td>
                          <td className="p-4 text-center"><input type="number" defaultValue={dish.nutrition?.fat || 0} onBlur={(e) => setDoc(doc(db, 'dishes', safeDocId), { nutrition: { ...dish.nutrition, fat: Number(e.target.value) } }, { merge: true })} className="w-20 p-2 bg-slate-50 border-none rounded-lg text-center outline-none focus:ring-2 focus:ring-orange-500 font-black" /></td>
                        </tr>
                      );
                    })}
                    {Object.keys(dishes).length === 0 && (<tr><td colSpan="6" className="p-10 text-center text-slate-400">目前未有菜品資料，請先匯入每月餐單。</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 🆕 全新：今日營運總覽 (依組合子 SKU 分類顯示) */}
        {activeTab === 'daily' && (
          <div className="space-y-8 animate-in fade-in duration-500">
             <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
               <div><h3 className="text-2xl font-black text-slate-800">今日出餐明細 (組合 SKU)</h3><p className="text-sm text-slate-400 font-bold mt-1">按實際落單的「菜式 + 飯類組合」進行精確統計</p></div>
               <div className="flex gap-4 items-center">
                 <div className="bg-emerald-50 text-emerald-700 px-6 py-4 rounded-2xl font-black border border-emerald-100">例湯總數: {dailyCombinationSummary.Soup}</div>
                 <div className="bg-rose-50 text-rose-700 px-6 py-4 rounded-2xl font-black border border-rose-100">生果總數: {dailyCombinationSummary.Fruit}</div>
               </div>
             </div>

             <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pb-20">
                {/* 渲染日常餐 A, B, C */}
                {MEALS.map(m => {
                  const mealData = dailyCombinationSummary[m];
                  if (mealData.total === 0) return null;
                  return (
                    <div key={m} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                      <div className="flex justify-between items-center mb-6 pb-4 border-b">
                        <div className="text-2xl font-black text-slate-800">{m}餐 <span className="text-orange-500 text-lg ml-2">總共 {mealData.total} 份</span></div>
                      </div>
                      
                      <div className="space-y-6">
                        {Object.keys(mealData.items).map(dishName => {
                          const dish = mealData.items[dishName];
                          const dishRecord = dishes[dishName.replace(/\//g, '或')];
                          const parentSku = dishRecord ? dishRecord.sku : '無記錄';
                          
                          return (
                            <div key={dishName} className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                              <div className="flex justify-between items-end mb-4">
                                <div><h4 className="font-black text-lg text-slate-700">{dishName}</h4><p className="text-[10px] text-slate-400 font-black mt-1">母 SKU: {parentSku}</p></div>
                                <span className="font-black text-slate-500">共 {dish.total} 份</span>
                              </div>
                              <div className="space-y-2">
                                {Object.keys(dish.combinations).map(comb => {
                                  const subSku = dishRecord && dishRecord.variations ? (dishRecord.variations[comb] || '未生成') : '未生成';
                                  return (
                                    <div key={comb} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
                                      <div className="flex items-center gap-3">
                                        <span className="font-bold text-sm text-slate-600">{comb.replace('_', ' + ')}</span>
                                        <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded font-black tracking-widest">{subSku}</span>
                                      </div>
                                      <span className="font-black text-orange-500 text-lg">{dish.combinations[comb]}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* 渲染特別餐 */}
                {dailyCombinationSummary.Special.total > 0 && (
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-purple-200 shadow-purple-100">
                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-purple-100">
                      <div className="text-2xl font-black text-purple-800">特別營養餐 <span className="text-orange-500 text-lg ml-2">總共 {dailyCombinationSummary.Special.total} 份</span></div>
                    </div>
                    
                    <div className="space-y-6">
                      {Object.keys(dailyCombinationSummary.Special.items).map(specName => {
                        const spec = dailyCombinationSummary.Special.items[specName];
                        return (
                          <div key={specName} className="bg-purple-50 p-6 rounded-3xl border border-purple-100">
                            <div className="flex justify-between items-end mb-4">
                              <h4 className="font-black text-lg text-purple-700">{specName}</h4><span className="font-black text-purple-500">共 {spec.total} 份</span>
                            </div>
                            <div className="space-y-2">
                              {Object.keys(spec.combinations).map(comb => (
                                <div key={comb} className="flex justify-between items-center bg-white p-3 rounded-xl border border-purple-100">
                                  <span className="font-bold text-sm text-purple-600">質感: {comb}</span>
                                  <span className="font-black text-orange-500 text-lg">{spec.combinations[comb]}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
             </div>
          </div>
        )}

        {/* 其他 Tab 保持原樣... */}
        {activeTab === 'recon' && (
          <div className="bg-white rounded-[3rem] shadow-sm border overflow-hidden animate-in fade-in duration-500">
            <div className="p-10 border-b flex justify-between items-center bg-slate-50/50"><div><h3 className="font-black text-2xl tracking-tighter">機構對數月度彙報 (含各餐點明細)</h3><p className="text-[10px] text-slate-400 font-black uppercase mt-2 tracking-widest">目前顯示月份：{selectedDate.substring(0, 7)}</p></div></div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr className="text-slate-400 text-[10px] uppercase font-black tracking-widest border-b"><th className="p-4 text-left pl-8">對數機構 / 團體單名稱</th><th className="p-4 text-center">A餐</th><th className="p-4 text-center">B餐</th><th className="p-4 text-center">C餐</th><th className="p-4 text-center text-purple-500">特別餐</th><th className="p-4 text-center">糊餐</th><th className="p-4 text-center">免治餐</th><th className="p-4 text-center">例湯</th><th className="p-4 text-center">生果</th><th className="p-4 text-center">總餐數</th></tr></thead>
              <tbody className="divide-y divide-slate-100 font-bold">
                {monthlyReconciliationData.map(r => (
                  <React.Fragment key={r.name}>
                    <tr className="bg-orange-50/50 hover:bg-orange-50 transition-colors"><td className="p-5 pl-8 text-lg font-black text-slate-800">🏢 {r.name}</td><td className="p-5 text-center text-lg font-black text-orange-600">{r.A}</td><td className="p-5 text-center text-lg font-black text-blue-600">{r.B}</td><td className="p-5 text-center text-lg font-black text-emerald-600">{r.C}</td><td className="p-5 text-center text-lg font-black text-purple-600">{r.Special}</td><td className="p-5 text-center text-lg font-black text-purple-400">{r.paste}</td><td className="p-5 text-center text-lg font-black text-rose-400">{r.minced}</td><td className="p-5 text-center text-lg font-black text-slate-500">{r.Soup}</td><td className="p-5 text-center text-lg font-black text-rose-500">{r.Fruit}</td><td className="p-5 text-center text-xl font-black text-slate-900">{r.totalMeals}</td></tr>
                    {Object.values(r.groups).map(g => (<tr key={g.name} className="hover:bg-slate-50 transition-colors text-slate-600"><td className="p-4 pl-14 border-l-4 border-orange-200">↳ {g.name} <span className="ml-2 px-2 py-0.5 bg-slate-100 text-[9px] rounded-full">{g.type}</span></td><td className="p-4 text-center text-slate-500">{g.A}</td><td className="p-4 text-center text-slate-500">{g.B}</td><td className="p-4 text-center text-slate-500">{g.C}</td><td className="p-4 text-center text-purple-500">{g.Special}</td><td className="p-4 text-center text-purple-400">{g.paste}</td><td className="p-4 text-center text-rose-400">{g.minced}</td><td className="p-4 text-center text-slate-400">{g.Soup}</td><td className="p-4 text-center text-rose-400">{g.Fruit}</td><td className="p-4 text-center font-black text-slate-800">{g.total}</td></tr>))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'blogs' && (<div className="space-y-8 animate-in fade-in duration-500"><div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100"><div><h3 className="text-2xl font-black text-slate-800">健康資訊管理</h3></div><button onClick={() => setEditingBlog({})} className="bg-orange-500 text-white px-6 py-4 rounded-2xl font-black shadow-lg"><Plus size={18}/> 新增文章</button></div><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{blogs.map(blog => (<div key={blog.id} className="bg-white p-8 rounded-[2.5rem] border shadow-sm"><div className="flex justify-between mb-4"><span className="text-[10px] font-black px-3 py-1 rounded-full bg-orange-50 text-orange-500">{blog.category}</span></div><h4 className="text-xl font-black mb-3">{blog.title}</h4><button onClick={() => setEditingBlog(blog)} className="w-full py-3 bg-slate-50 rounded-xl font-black text-sm">修改文章</button></div>))}</div></div>)}

        {activeTab === 'add' && (<div className="max-w-4xl mx-auto space-y-8"><div className="bg-white p-16 rounded-[4rem] shadow-sm border-4 border-dashed border-slate-100 flex flex-col items-center text-center"><Upload size={56} className="text-orange-500 mb-8" /><h3 className="text-2xl font-black mb-4">全月批量訂單導入 (Excel)</h3><label className="bg-orange-500 text-white px-12 py-5 rounded-3xl font-black text-lg cursor-pointer">選擇檔案導入<input type="file" onChange={handleMassImportOrders} className="hidden" /></label></div><div className="bg-white p-16 rounded-[4rem] shadow-sm border-4 border-dashed border-slate-100 flex flex-col items-center text-center"><Users size={56} className="text-blue-500 mb-8" /><h3 className="text-2xl font-black mb-4">批量導入客戶資料表</h3><label className="bg-blue-600 text-white px-12 py-5 rounded-3xl font-black text-lg cursor-pointer">選擇客戶表導入<input type="file" onChange={handleCustImport} className="hidden" /></label></div></div>)}

        {activeTab === 'settings' && (<div className="grid grid-cols-2 gap-8"><div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100"><h3 className="text-2xl font-black mb-6">系統選項設定</h3></div></div>)}

        {selectedCustomer && (<CustomerCalendar customer={selectedCustomer} currentMonth={currentMonth} setCurrentMonth={setCurrentMonth} currentYear={currentYear} menus={menus} db={db} onClose={() => setSelectedCustomer(null)} />)}
        {editingCustomer && (<CustomerEditModal customer={editingCustomer} db={db} sysSettings={sysSettings} onClose={() => setEditingCustomer(null)} />)}
        {editingBlog && (<BlogEditModal blog={editingBlog} db={db} onClose={() => setEditingBlog(null)} />)}
      </main>
      <style>{`::-webkit-scrollbar { width: 8px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }`}</style>
    </div>
  );
}
