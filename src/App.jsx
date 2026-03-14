import React, { useState, useEffect } from 'react';
import { 
  Users, ClipboardList, Printer, FileSpreadsheet, Settings, 
  ChefHat, Upload, Lock, History, Search, Plus
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase'; 

const TEXTURES = ['正', '碎', '免治', '分糊', '全糊'];
const MEALS = ['A', 'B', 'C'];
const ZONES = ['沙田及北區線', '葵青荃灣線', '觀塘線', '屯元天線', '土瓜環步兵', '團體線'];

export default function WeCareUltimateSystem() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('batch'); 
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menuNames, setMenuNames] = useState({ A: '', B: '', C: '', Soup: '' });
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [newCust, setNewCust] = useState({ id: '', name: '', address: '', phone: '', zone: ZONES[0] });

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => setIsAuthenticated(!!user));
    if (isAuthenticated) {
      onSnapshot(collection(db, "customers"), (s) => setCustomers(s.docs.map(d => d.data())));
      onSnapshot(doc(db, "menus", selectedDate), (d) => setMenuNames(d.exists() ? d.data() : { A: '', B: '', C: '', Soup: '' }));
      onSnapshot(query(collection(db, "orders"), where("date", "==", selectedDate)), (s) => setOrders(s.docs.map(d => d.data())));
    }
    return () => unsubAuth();
  }, [isAuthenticated, selectedDate]);

  const handleImport = (e, type) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      for (let row of data) {
        if (type === 'menu') {
          const match = row["日期"]?.match(/(\d+)月(\d+)日/);
          if (match && row["(A餐)款式"]) {
            const date = `2026-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
            await setDoc(doc(db, "menus", date), {
              A: row["(A餐)款式"] || "", B: row["(B餐)款式"] || "", C: row["(C餐)款式"] || "", Soup: row["(例湯)"] || ""
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

  const addCustomer = async () => {
    if (!newCust.id || !newCust.name) return alert("請輸入編號及姓名");
    await setDoc(doc(db, "customers", newCust.id), newCust);
    setNewCust({ id: '', name: '', address: '', phone: '', zone: ZONES[0] });
  };

  if (!isAuthenticated) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">WeCare 登入</h2>
        <input type="email" placeholder="電郵" className="w-full border p-3 rounded-xl mb-4" onChange={e => setLoginData({...loginData, email: e.target.value})} />
        <input type="password" placeholder="密碼" className="w-full border p-3 rounded-xl mb-6" onChange={e => setLoginData({...loginData, password: e.target.value})} />
        <button onClick={() => signInWithEmailAndPassword(auth, loginData.email, loginData.password)} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold">登入</button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <aside className="w-64 bg-slate-800 text-white p-6 no-print">
        <div className="text-orange-400 font-black text-xl mb-8">WECARE PRO</div>
        <nav className="space-y-2">
          <button onClick={() => setActiveTab('batch')} className={`w-full text-left p-3 rounded-xl ${activeTab === 'batch' ? 'bg-orange-500' : ''}`}>每日入單</button>
          <button onClick={() => setActiveTab('labels')} className={`w-full text-left p-3 rounded-xl ${activeTab === 'labels' ? 'bg-orange-500' : ''}`}>打印標籤</button>
          <button onClick={() => setActiveTab('customers')} className={`w-full text-left p-3 rounded-xl ${activeTab === 'customers' ? 'bg-blue-600' : ''}`}>客戶管理</button>
          <button onClick={() => setActiveTab('import')} className={`w-full text-left p-3 rounded-xl ${activeTab === 'import' ? 'bg-slate-700' : ''}`}>批量導入</button>
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
                    <tr key={c.id} className="border-b">
                      <td className="p-4 font-bold">{c.name}<div className="text-[10px] text-slate-400">{c.zone}</div></td>
                      {TEXTURES.map(t => (
                        <td key={t} className="p-2 border-x">
                          {MEALS.map(m => (
                            <div key={m} className="flex items-center gap-1 mb-1">
                              <span className="text-[9px] w-3">{m}</span>
                              <input type="number" value={order.counts?.[`${m}_${t}`] || ''} onChange={async (e) => {
                                const val = parseInt(e.target.value) || 0;
                                await setDoc(doc(db, "orders", `${selectedDate}_${c.id}`), { ...order, date: selectedDate, customerId: c.id, counts: { ...order.counts, [`${m}_${t}`]: val } });
                              }} className="w-10 border rounded text-center text-xs" />
                            </div>
                          ))}
                        </td>
                      ))}
                      <td className="p-4"><input className="w-full border rounded p-1" value={order.notes || ''} onChange={async (e) => await setDoc(doc(db, "orders", `${selectedDate}_${c.id}`), { ...order, date: selectedDate, customerId: c.id, notes: e.target.value }, { merge: true })} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'import' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl border-2 border-dashed text-center">
              <ChefHat size={40} className="mx-auto text-orange-500 mb-4"/>
              <h3 className="font-bold mb-4">導入每月餐單 (做法 A)</h3>
              <input type="file" onChange={(e) => handleImport(e, 'menu')} className="text-sm" />
            </div>
            <div className="bg-white p-8 rounded-3xl border-2 border-dashed text-center">
              <Users size={40} className="mx-auto text-blue-500 mb-4"/>
              <h3 className="font-bold mb-4">導入客戶名單</h3>
              <input type="file" onChange={(e) => handleImport(e, 'cust')} className="text-sm" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
