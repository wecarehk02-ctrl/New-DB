import React, { useState, useEffect } from 'react';
import { 
  Users, ClipboardList, Printer, FileSpreadsheet, Settings, 
  ChefHat, Upload, History, Search, Plus, Trash2, Calendar
} from 'lucide-react';
import { 
  collection, onSnapshot, doc, setDoc, getDocs, query, where, orderBy, deleteDoc 
} from 'firebase/firestore';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase'; 

// 常量定義
const TEXTURES = ['正', '碎', '免治', '分糊', '全糊'];
const MEALS = ['A', 'B', 'C'];
const ZONES = ['沙田及北區線', '葵青荃灣線', '觀塘線', '屯元天線', '土瓜環步兵', '團體線'];

export default function WeCareUltimateSystem() {
  // --- 狀態管理 ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('batch'); 
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // 數據狀態 (初始全空)
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menuNames, setMenuNames] = useState({ A: '', B: '', C: '', Soup: '' });
  
  // 介面與輸入狀態
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [newCust, setNewCust] = useState({ id: '', name: '', address: '', phone: '', zone: ZONES[0], requirement: '' });

  // --- 1. Firebase 監聽 ---
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
    });

    if (isAuthenticated) {
      // 監聽客戶 (按 ID 排序)
      const unsubCust = onSnapshot(collection(db, "customers"), (snap) => {
        const custData = snap.docs.map(d => d.data());
        setCustomers(custData.sort((a, b) => String(a.id).localeCompare(String(b.id))));
      });

      // 監聽當日菜單
      const unsubMenu = onSnapshot(doc(db, "menus", selectedDate), (d) => {
        setMenuNames(d.exists() ? d.data() : { A: '', B: '', C: '', Soup: '' });
      });

      // 監聽當日訂單
      const q = query(collection(db, "orders"), where("date", "==", selectedDate));
      const unsubOrders = onSnapshot(q, (snap) => {
        setOrders(snap.docs.map(d => d.data()));
      });

      return () => { unsubCust(); unsubMenu(); unsubOrders(); };
    }
    return () => unsubAuth();
  }, [isAuthenticated, selectedDate]);

  // --- 2. 批量導入邏輯 (Excel) ---
  const handleImport = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      
      for (let row of data) {
        if (type === 'menu') {
          // 菜單導入：處理 "4月1日(三)" 格式
          const match = row["日期"]?.match(/(\d+)月(\d+)日/);
          if (match) {
            const dateStr = `2026-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
            await setDoc(doc(db, "menus", dateStr), {
              A: row["(A餐)款式"] || "",
              B: row["(B餐)款式"] || "",
              C: row["(C餐)款式"] || "",
              Soup: row["(例湯)"] || ""
            });
          }
        } else {
          // 客戶導入：強制 ID 為 String
          const id = String(row.ID || row.id || "");
          if (id) {
            await setDoc(doc(db, "customers", id), {
              id,
              name: row.姓名 || row.name || "",
              phone: row.電話 || row.phone || "",
              address: row.地址 || row.address || "",
              zone: row.線路 || row.zone || "未分類線路",
              requirement: row.特別要求 || row.requirement || ""
            });
          }
        }
      }
      alert(`${type === 'menu' ? '菜單' : '客戶資料'}導入成功！`);
    };
    reader.readAsBinaryString(file);
  };

  // --- 3. 手動操作功能 ---
  const handleAddCustomer = async () => {
    if (!newCust.id || !newCust.name) return alert("請輸入 ID 及姓名");
    await setDoc(doc(db, "customers", newCust.id), newCust);
    setNewCust({ id: '', name: '', address: '', phone: '', zone: ZONES[0], requirement: '' });
    alert("客戶新增成功");
  };

  const handleUpdateOrder = async (custId, field, value) => {
    const orderId = `${selectedDate}_${custId}`;
    const existing = orders.find(o => o.customerId === custId) || {
      date: selectedDate, customerId: custId, counts: {}, notes: ''
    };
    
    let updatedOrder;
    if (field === 'notes') {
      updatedOrder = { ...existing, notes: value };
    } else {
      updatedOrder = { ...existing, counts: { ...existing.counts, [field]: parseInt(value) || 0 } };
    }
    await setDoc(doc(db, "orders", orderId), updatedOrder);
  };

  // --- 4. 登入介面 ---
  if (!isAuthenticated) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <ChefHat size={48} className="mx-auto text-orange-500 mb-2"/>
          <h1 className="text-2xl font-bold text-slate-800">WeCare 營運系統</h1>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); signInWithEmailAndPassword(auth, loginData.email, loginData.password).catch(err => setLoginError("登入失敗")); }}>
          <input type="email" placeholder="電郵" className="w-full border p-3 rounded-xl mb-4" onChange={e => setLoginData({...loginData, email: e.target.value})} />
          <input type="password" placeholder="密碼" className="w-full border p-3 rounded-xl mb-6" onChange={e => setLoginData({...loginData, password: e.target.value})} />
          {loginError && <p className="text-red-500 mb-4 text-sm font-bold">{loginError}</p>}
          <button type="submit" className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition-colors">進入系統代碼</button>
        </form>
      </div>
    </div>
  );

  // --- 5. 主介面 ---
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <aside className="w-64 bg-slate-800 text-white p-6 no-print">
        <div className="text-orange-400 font-black text-xl mb-10 tracking-tighter">WECARE PRO</div>
        <nav className="space-y-2">
          <button onClick={() => setActiveTab('batch')} className={`w-full text-left p-3 rounded-xl flex items-center gap-3 ${activeTab === 'batch' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:bg-slate-700'}`}><ClipboardList size={18}/> 每日入單</button>
          <button onClick={() => setActiveTab('labels')} className={`w-full text-left p-3 rounded-xl flex items-center gap-3 ${activeTab === 'labels' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:bg-slate-700'}`}><Printer size={18}/> 打印標籤</button>
          <button onClick={() => setActiveTab('customers')} className={`w-full text-left p-3 rounded-xl flex items-center gap-3 ${activeTab === 'customers' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}><Users size={18}/> 客戶管理</button>
          <button onClick={() => setActiveTab('import')} className={`w-full text-left p-3 rounded-xl flex items-center gap-3 ${activeTab === 'import' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}><Upload size={18}/> 批量導入</button>
        </nav>
        <button onClick={() => signOut(auth)} className="mt-10 text-xs text-slate-500 hover:text-white underline">登出系統</button>
      </aside>

      <main className="flex-1 p-8 overflow-auto">
        <header className="flex justify-between items-center mb-8 no-print">
          <h2 className="text-2xl font-bold uppercase tracking-widest">{activeTab === 'batch' ? '每日入單矩陣' : activeTab}</h2>
          <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border">
            <Calendar size={18} className="text-slate-400" />
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="font-bold outline-none" />
          </div>
        </header>

        {activeTab === 'batch' && (
          <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 text-left w-48">客戶 (線路)</th>
                  {TEXTURES.map(t => <th key={t} className="p-2 text-center border-x bg-slate-100/50">{t}</th>)}
                  <th className="p-4">當日備註</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customers.map(c => {
                  const order = orders.find(o => o.customerId === c.id) || { counts: {}, notes: '' };
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{c.name}</div>
                        <div className="text-[10px] text-slate-400">{c.zone}</div>
                      </td>
                      {TEXTURES.map(t => (
                        <td key={t} className="p-2 border-x">
                          {MEALS.map(m => (
                            <div key={m} className="flex items-center gap-1 mb-1">
                              <span className="text-[9px] w-3 font-bold text-slate-400">{m}</span>
                              <input 
                                type="number" 
                                value={order.counts?.[`${m}_${t}`] || ''} 
                                onChange={(e) => handleUpdateOrder(c.id, `${m}_${t}`, e.target.value)}
                                className="w-10 border rounded text-center p-1 focus:ring-1 focus:ring-orange-500 outline-none" 
                              />
                            </div>
                          ))}
                        </td>
                      ))}
                      <td className="p-4">
                        <input 
                          value={order.notes || ''} 
                          onChange={(e) => handleUpdateOrder(c.id, 'notes', e.target.value)}
                          className="w-full border rounded p-2 text-[11px]" 
                          placeholder={c.requirement || "輸入特別要求..."}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'import' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-3xl border-2 border-dashed border-slate-200 text-center">
              <ChefHat size={48} className="mx-auto text-orange-500 mb-4"/>
              <h3 className="font-bold text-lg mb-2">導入月份餐單</h3>
              <p className="text-sm text-slate-400 mb-6">支援日期格式：4月1日(三)</p>
              <input type="file" onChange={(e) => handleImport(e, 'menu')} className="text-xs file:bg-orange-50 file:text-orange-700 file:border-0 file:px-4 file:py-2 file:rounded-full file:font-bold cursor-pointer" />
            </div>
            <div className="bg-white p-10 rounded-3xl border-2 border-dashed border-slate-200 text-center">
              <Users size={48} className="mx-auto text-blue-500 mb-4"/>
              <h3 className="font-bold text-lg mb-2">導入客戶名單</h3>
              <p className="text-sm text-slate-400 mb-6">欄位：ID, 姓名, 地址, 線路, 電話, 特別要求</p>
              <input type="file" onChange={(e) => handleImport(e, 'cust')} className="text-xs file:bg-blue-50 file:text-blue-700 file:border-0 file:px-4 file:py-2 file:rounded-full file:font-bold cursor-pointer" />
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <h3 className="font-bold mb-4 flex items-center gap-2"><Plus size={18}/> 手動新增客戶</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <input placeholder="編號 (ID)" value={newCust.id} onChange={e => setNewCust({...newCust, id: e.target.value})} className="border p-2 rounded-lg text-sm" />
                <input placeholder="姓名" value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value})} className="border p-2 rounded-lg text-sm" />
                <input placeholder="電話" value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value})} className="border p-2 rounded-lg text-sm" />
                <select value={newCust.zone} onChange={e => setNewCust({...newCust, zone: e.target.value})} className="border p-2 rounded-lg text-sm">
                  {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
                <input placeholder="地址" value={newCust.address} onChange={e => setNewCust({...newCust, address: e.target.value})} className="border p-2 rounded-lg text-sm col-span-2" />
                <input placeholder="預設特別要求" value={newCust.requirement} onChange={e => setNewCust({...newCust, requirement: e.target.value})} className="border p-2 rounded-lg text-sm col-span-1" />
                <button onClick={handleAddCustomer} className="bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors text-sm">新增資料</button>
              </div>
            </div>
            {/* 客戶列表可在此延伸 */}
          </div>
        )}

        {activeTab === 'labels' && (
          <div className="grid grid-cols-2 gap-4 print:grid-cols-2 print:gap-2">
            {orders.map(o => {
              const c = customers.find(cust => cust.id === o.customerId);
              if (!c) return null;
              // 檢查是否有任何數量的餐
              const hasOrder = Object.values(o.counts || {}).some(v => v > 0);
              if (!hasOrder) return null;

              return (
                <div key={o.customerId} className="bg-white border-2 border-black p-6 h-[320px] relative flex flex-col print:m-0 break-inside-avoid">
                  <div className="text-center border-b-2 border-black mb-2 pb-2">
                    <div className="text-4xl font-bold">{c.name}</div>
                  </div>
                  <div className="text-[11px] font-bold mb-4 h-10 overflow-hidden leading-tight">{c.address}</div>
                  <div className="flex-1 space-y-1 font-bold text-sm">
                    {TEXTURES.map(t => MEALS.map(m => {
                      const qty = o.counts?.[`${m}_${t}`];
                      if (!qty || qty <= 0) return null;
                      return (
                        <div key={`${m}_${t}`} className="flex justify-between border-b border-dotted border-slate-300">
                          <span>({m}餐-{t}) {menuNames[m]}</span>
                          <span>{qty}</span>
                        </div>
                      );
                    }))}
                    <div className="flex justify-between pt-1 text-slate-600">
                      <span>今日例湯: {menuNames.Soup}</span>
                      <span>1</span>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-red-600 font-bold italic">{o.notes || c.requirement}</div>
                  <div className="absolute top-2 left-2 text-[9px] border border-black px-1 font-bold bg-white">{c.zone}</div>
                  <div className="absolute bottom-4 right-4 w-12 h-12 rounded-full border-2 border-black flex items-center justify-center text-xl font-black italic">
                    {c.zone.includes('團體') ? 'G' : 'P'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; background: white; }
          .flex-1 { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  );
}
