import React, { useState, useEffect } from 'react';
import { 
  Users, ClipboardList, Printer, FileSpreadsheet, Save, Settings, 
  ChefHat, Download, Upload, Lock, History, Search, Plus, Trash2
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase'; 

// 定義餐類規格
const TEXTURES = ['正', '碎', '免治', '分糊', '全糊'];
const MEALS = ['A', 'B', 'C'];
const ZONES = ['沙田及北區線', '葵青荃灣線', '觀塘線', '屯元天線', '土瓜環步兵', '團體線'];

export default function WeCareProSystem() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('batch'); 
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menuNames, setMenuNames] = useState({ A: '', B: '', C: '', Soup: '', Dessert: '' });
  
  // 登入 & 客戶手動新增 State
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [newCust, setNewCust] = useState({ id: '', name: '', address: '', phone: '', zone: ZONES[0] });

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => setIsAuthenticated(!!user));
    if (isAuthenticated) {
      onSnapshot(collection(db, "customers"), (s) => setCustomers(s.docs.map(d => d.data())));
      onSnapshot(doc(db, "menus", selectedDate), (d) => setMenuNames(d.exists() ? d.data() : { A: '', B: '', C: '', Soup: '', Dessert: '' }));
      onSnapshot(query(collection(db, "orders"), where("date", "==", selectedDate)), (s) => setOrders(s.docs.map(d => d.data())));
    }
  }, [isAuthenticated, selectedDate]);

  // --- 批量導入邏輯 ---
  const handleImport = (e, type) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

      for (let row of data) {
        if (type === 'menu') {
          const match = row["日期"]?.match(/(\d+)月(\d+)日/);
          if (match) {
            const date = `2026-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
            await setDoc(doc(db, "menus", date), {
              A: row["(A餐)款式"] || "", B: row["(B餐)款式"] || "", C: row["(C餐)款式"] || "", 
              Soup: row["(例湯)"] || "", Dessert: row["(糖水)"] || ""
            });
          }
        } else {
          await setDoc(doc(db, "customers", String(row.ID)), { ...row, id: String(row.ID) });
        }
      }
      alert("導入完成！");
    };
    reader.readAsBinaryString(file);
  };

  // --- 手動新增客戶 ---
  const addCustomer = async () => {
    if (!newCust.id || !newCust.name) return alert("請輸入編號及姓名");
    await setDoc(doc(db, "customers", newCust.id), newCust);
    setNewCust({ id: '', name: '', address: '', phone: '', zone: ZONES[0] });
    alert("客戶已新增");
  };

  if (!isAuthenticated) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">WeCare 營運登入</h2>
        <input type="email" placeholder="電郵" className="w-full border p-3 rounded-xl mb-4" onChange={e => setLoginData({...loginData, email: e.target.value})} />
        <input type="password" placeholder="密碼" className="w-full border p-3 rounded-xl mb-6" onChange={e => setLoginData({...loginData, password: e.target.value})} />
        <button onClick={() => signInWithEmailAndPassword(auth, loginData.email, loginData.password)} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold">登入</button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 bg-slate-800 text-white p-6 no-print">
        <div className="text-orange-400 font-black text-xl mb-8">WECARE PRO</div>
        <nav className="space-y-2">
          {['batch', 'labels', 'customers', 'import'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full text-left p-3 rounded-xl capitalize ${activeTab === tab ? 'bg-orange-500' : 'hover:bg-slate-700'}`}>
              {tab === 'batch' ? '每日入單' : tab === 'labels' ? '打印標籤' : tab === 'customers' ? '客戶管理' : '批量導入'}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-8 no-print">
          <h2 className="text-2xl font-bold uppercase">{activeTab}</h2>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border p-2 rounded-xl font-bold" />
        </div>

        {activeTab === 'batch' && (
          <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 text-left">客戶資料</th>
                  {TEXTURES.map(t => <th key={t} className="p-2 text-center border-x">{t}</th>)}
                  <th className="p-4">備註</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => {
                  const order = orders.find(o => o.customerId === c.id) || { counts: {} };
                  return (
                    <tr key={c.id} className="border-b hover:bg-slate-50">
                      <td className="p-4">
                        <div className="font-bold">{c.name}</div>
                        <div className="text-[10px] text-slate-400">{c.zone}</div>
                      </td>
                      {TEXTURES.map(t => (
                        <td key={t} className="p-2 border-x bg-slate-50/30">
                          <div className="flex flex-col gap-1">
                            {MEALS.map(m => (
                              <div key={m} className="flex items-center gap-1">
                                <span className="text-[9px] font-bold w-3">{m}</span>
                                <input 
                                  type="number" 
                                  value={order.counts?.[`${m}_${t}`] || ''} 
                                  onChange={async (e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    const newOrder = { ...order, date: selectedDate, customerId: c.id, counts: { ...order.counts, [`${m}_${t}`]: val } };
                                    await setDoc(doc(db, "orders", `${selectedDate}_${c.id}`), newOrder);
                                  }}
                                  className="w-10 border rounded text-center text-xs p-1"
                                />
                              </div>
                            ))}
                          </div>
                        </td>
                      ))}
                      <td className="p-4">
                        <input className="w-full border rounded p-2" placeholder="特別要求" value={order.notes || ''} onChange={async (e) => {
                          await setDoc(doc(db, "orders", `${selectedDate}_${c.id}`), { ...order, date: selectedDate, customerId: c.id, notes: e.target.value }, { merge: true });
                        }} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="bg-white p-6 rounded-2xl border shadow-sm">
            <h3 className="font-bold mb-4 flex items-center gap-2"><Plus size={18}/> 手動新增客戶</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <input placeholder="編號 (ID)" value={newCust.id} onChange={e => setNewCust({...newCust, id: e.target.value})} className="border p-2 rounded-lg" />
              <input placeholder="姓名" value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value})} className="border p-2 rounded-lg" />
              <input placeholder="電話" value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value})} className="border p-2 rounded-lg" />
              <input placeholder="地址" value={newCust.address} onChange={e => setNewCust({...newCust, address: e.target.value})} className="border p-2 rounded-lg col-span-2" />
              <select value={newCust.zone} onChange={e => setNewCust({...newCust, zone: e.target.value})} className="border p-2 rounded-lg">
                {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
              <button onClick={addCustomer} className="bg-blue-600 text-white p-2 rounded-lg font-bold">儲存客戶</button>
            </div>
          </div>
        )}

        {activeTab === 'import' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl border-2 border-dashed text-center">
              <ChefHat size={40} className="mx-auto text-orange-500 mb-4"/>
              <h3 className="font-bold mb-4">每月餐單導入</h3>
              <input type="file" onChange={(e) => handleImport(e, 'menu')} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
            </div>
            <div className="bg-white p-8 rounded-3xl border-2 border-dashed text-center">
              <Users size={40} className="mx-auto text-blue-500 mb-4"/>
              <h3 className="font-bold mb-4">客戶名單導入</h3>
              <input type="file" onChange={(e) => handleImport(e, 'cust')} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
