import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, ClipboardList, Printer, FileSpreadsheet, Save, Settings, 
  ChefHat, Download, Upload, Lock, History, Search, Calendar, Trash2
} from 'lucide-react';
import { 
  collection, onSnapshot, doc, setDoc, getDocs, query, where, deleteDoc 
} from 'firebase/firestore';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase'; 

export default function WeCareUltimateSystem() {
  // --- 狀態管理 ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('batch'); 
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState([]); // 初始為空，不再使用假數據
  const [orders, setOrders] = useState([]);
  const [menuNames, setMenuNames] = useState({ A: '', B: '', C: '', Soup: '', Dessert: '' });
  
  // 登入相關
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- 1. 權限與數據監聽 ---
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) setIsAuthenticated(true);
      else setIsAuthenticated(false);
    });

    if (isAuthenticated) {
      const unsubCust = onSnapshot(collection(db, "customers"), (snap) => {
        setCustomers(snap.docs.map(d => d.data()));
      });

      const unsubMenu = onSnapshot(doc(db, "menus", selectedDate), (d) => {
        if (d.exists()) setMenuNames(d.data());
        else setMenuNames({ A: '', B: '', C: '', Soup: '', Dessert: '' });
      });

      const unsubOrders = onSnapshot(query(collection(db, "orders"), where("date", "==", selectedDate)), (snap) => {
        setOrders(snap.docs.map(d => d.data()));
      });

      return () => { unsubCust(); unsubMenu(); unsubOrders(); unsubAuth(); };
    }
    return () => unsubAuth();
  }, [isAuthenticated, selectedDate]);

  // --- 2. 批量導入邏輯 (Excel) ---
  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);

      if (type === 'menu') {
        // 處理菜單導入 (轉換日期格式 4月1日(三) -> 2026-04-01)
        for (let row of data) {
          const rawDate = row["日期"]; 
          if (!rawDate) continue;
          const dayMatch = rawDate.match(/(\d+)月(\d+)日/);
          if (dayMatch) {
            const formattedDate = `2026-${dayMatch[1].padStart(2, '0')}-${dayMatch[2].padStart(2, '0')}`;
            await setDoc(doc(db, "menus", formattedDate), {
              A: row["(A餐)款式"] || "",
              B: row["(B餐)款式"] || "",
              C: row["(C餐)款式"] || "",
              Soup: row["(例湯)"] || "",
              Dessert: row["(糖水)"] || ""
            });
          }
        }
        alert("菜單導入成功！");
      } else if (type === 'customers') {
        // 處理客戶批量導入
        for (let row of data) {
          await setDoc(doc(db, "customers", String(row.ID)), {
            id: String(row.ID),
            name: row.姓名,
            phone: row.電話 || "",
            address: row.地址,
            zone: row.線路,
            texture: row.規格 || "正",
            requirement: row.特別要求 || ""
          });
        }
        alert("客戶資料導入成功！");
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- 3. 登入邏輯 ---
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) { setLoginError("登入失敗，請檢查電郵及密碼"); }
  };

  // --- 4. 渲染登入介面 ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <form onSubmit={handleLogin} className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md">
          <div className="text-center mb-8">
            <ChefHat size={48} className="mx-auto text-orange-500 mb-2"/>
            <h1 className="text-2xl font-bold">WeCare 營運系統</h1>
            <p className="text-slate-400">請登入以管理送餐數據</p>
          </div>
          <input type="email" placeholder="管理員電郵" className="w-full border p-3 rounded-xl mb-4" onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="密碼" className="w-full border p-3 rounded-xl mb-6" onChange={e => setPassword(e.target.value)} />
          {loginError && <p className="text-red-500 mb-4 text-sm font-bold">{loginError}</p>}
          <button className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl hover:bg-orange-600">登入系統</button>
        </form>
      </div>
    );
  }

  // --- 5. 主介面渲染 (報表與導入中心) ---
  return (
    <div className="flex min-h-screen bg-slate-50">
      <nav className="w-64 bg-slate-800 text-white p-6 space-y-4 no-print">
        <div className="text-orange-400 font-black text-xl mb-10">WECARE PRO</div>
        <button onClick={() => setActiveTab('batch')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 ${activeTab === 'batch' ? 'bg-orange-500' : ''}`}><ClipboardList size={18}/> 每日入單</button>
        <button onClick={() => setActiveTab('labels')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 ${activeTab === 'labels' ? 'bg-orange-500' : ''}`}><Printer size={18}/> 打印標籤</button>
        <button onClick={() => setActiveTab('import')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 ${activeTab === 'import' ? 'bg-blue-600' : ''}`}><Upload size={18}/> 批量導入</button>
      </nav>

      <main className="flex-1 p-10">
        <header className="flex justify-between items-center mb-10 no-print">
          <h2 className="text-2xl font-bold uppercase tracking-widest">{activeTab}</h2>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border p-2 rounded-xl font-bold" />
        </header>

        {activeTab === 'import' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-slate-200 text-center">
              <FileSpreadsheet size={40} className="mx-auto text-blue-500 mb-4"/>
              <h3 className="font-bold mb-2">導入月份菜單 (Excel)</h3>
              <p className="text-xs text-slate-400 mb-6">請使用包含「日期、(A餐)款式...」的檔案 </p>
              <input type="file" onChange={(e) => handleFileUpload(e, 'menu')} className="hidden" id="menu-up" />
              <label htmlFor="menu-up" className="bg-blue-500 text-white px-6 py-2 rounded-full cursor-pointer hover:bg-blue-600 transition-colors">選擇檔案</label>
            </div>
            
            <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-slate-200 text-center">
              <Users size={40} className="mx-auto text-emerald-500 mb-4"/>
              <h3 className="font-bold mb-2">導入客戶名單 (Excel)</h3>
              <p className="text-xs text-slate-400 mb-6">包含姓名、地址、線路、電話等欄位 </p>
              <input type="file" onChange={(e) => handleFileUpload(e, 'customers')} className="hidden" id="cust-up" />
              <label htmlFor="cust-up" className="bg-emerald-500 text-white px-6 py-2 rounded-full cursor-pointer hover:bg-emerald-600 transition-colors">選擇檔案</label>
            </div>
          </div>
        )}

        {/* 這裡加入之前的 LabelView 及 BatchOrderView 組件 */}
      </main>
    </div>
  );
}
