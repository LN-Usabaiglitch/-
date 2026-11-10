import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from './cloud.js';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Wallet, TrendingUp, PiggyBank, Target, Plus, Trash2, Download, RotateCcw, LayoutDashboard, CircleDollarSign, CalendarDays, LogOut } from 'lucide-react';

const KEY = 'smart-money-planner-v1';
const defaultState = {
  income: 3000000,
  currency: 'LAK',
  categories: [
    { id: 1, name: 'ค่าใช้จ่ายจำเป็น', percent: 40, color: '#64748b' },
    { id: 2, name: 'เงินสำรองฉุกเฉิน', percent: 20, color: '#0ea5e9' },
    { id: 3, name: 'เงินลงทุน', percent: 20, color: '#8b5cf6' },
    { id: 4, name: 'เงินออม', percent: 10, color: '#10b981' },
    { id: 5, name: 'โอกาสทางธุรกิจ', percent: 10, color: '#f59e0b' }
  ],
  expenses: [],
  monthly: {},
  fixed: [],
  goal: 50000000,
  months: 36
};

function loadState() {
  try {
    const saved = localStorage.getItem(KEY);
    return saved ? { ...defaultState, ...JSON.parse(saved) } : defaultState;
  } catch { return defaultState; }
}
const money = (n, currency) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + ' ' + currency;
const today = () => new Date().toISOString().slice(0, 10);

function Planner() {
  const [data, setData] = useState(loadState);
  const [tab, setTab] = useState('overview');
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(today());
  const [goalInput, setGoalInput] = useState(String(data.goal));
  const [monthsInput, setMonthsInput] = useState(String(data.months));
  const [incomeInput, setIncomeInput] = useState(String(data.income));

  const dataRef = useRef(data);
  const saveTimer = useRef(null);
  const [sync, setSync] = useState('loading');
  const ref = useMemo(() => doc(db, 'money', 'main'), []);
  useEffect(() => {
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const v = { ...defaultState, ...snap.data() };
        dataRef.current = v; setData(v); localStorage.setItem(KEY, JSON.stringify(v)); setSync('ok');
      } else {
        setDoc(ref, dataRef.current).then(() => setSync('ok')).catch(() => setSync('error'));
      }
    }, () => setSync('error'));
    return () => unsub();
  }, [ref]);
  const update = (next) => {
    const value = typeof next === 'function' ? next(dataRef.current) : next;
    dataRef.current = value; setData(value);
    localStorage.setItem(KEY, JSON.stringify(value));
    setSync('saving'); clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setDoc(ref, dataRef.current).then(() => setSync('ok')).catch(() => setSync('error')), 500);
  };

  const [month, setMonth] = useState(today().slice(0, 7));
  const [monthIncomeInput, setMonthIncomeInput] = useState('');
  const [fixedName, setFixedName] = useState('');
  const [fixedAmount, setFixedAmount] = useState('');
  useEffect(() => { setMonthIncomeInput(String(data.monthly?.[month] ?? data.income)); }, [month, data.monthly, data.income]);
  const fixedList = data.fixed || [];
  const fixedTotal = fixedList.reduce((s, f) => s + Number(f.amount), 0);
  const daily = useMemo(() => {
    const [Y, M] = month.split('-').map(Number);
    const dim = new Date(Y, M, 0).getDate();
    const income = Number(data.monthly?.[month] ?? data.income) || 0;
    const budget = income - fixedTotal;
    const perDay = budget / dim;
    const spendBy = {}; let spentMonth = 0;
    data.expenses.forEach(e => { if (e.date.startsWith(month)) { const d = Number(e.date.slice(8, 10)); spendBy[d] = (spendBy[d] || 0) + Number(e.amount); spentMonth += Number(e.amount); } });
    const t = today(), cur = t.slice(0, 7);
    const lastDay = month < cur ? dim : month === cur ? Number(t.slice(8, 10)) : 0;
    const rows = []; let carry = 0;
    for (let d = 1; d <= lastDay; d++) {
      const avail = perDay + carry, spent = spendBy[d] || 0, left = avail - spent;
      rows.push({ d, avail, spent, left }); carry = left;
    }
    const today_ = rows[rows.length - 1];
    const daysLeft = month === cur ? dim - lastDay + 1 : 0;
    const spentBefore = today_ ? spentMonth - today_.spent : 0;
    return { dim, income, budget, perDay, rows: rows.slice().reverse(), spentMonth, today_, remaining: budget - spentMonth, avgLeft: daysLeft ? (budget - spentBefore) / daysLeft : 0, isCurrent: month === cur };
  }, [month, data, fixedTotal]);
  const addFixed = (e) => {
    e.preventDefault();
    const amount = Number(fixedAmount);
    if (!fixedName.trim() || !Number.isFinite(amount) || amount <= 0) return;
    update(p => ({ ...p, fixed: [...(p.fixed || []), { id: Date.now(), name: fixedName.trim(), amount }] }));
    setFixedName(''); setFixedAmount('');
  };
  const removeFixed = id => update(p => ({ ...p, fixed: (p.fixed || []).filter(f => f.id !== id) }));

  const allocated = useMemo(() => data.categories.map(c => ({ ...c, amount: data.income * c.percent / 100 })), [data]);
  const totalPercent = data.categories.reduce((s, c) => s + Number(c.percent || 0), 0);
  const totalExpenses = data.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const expenseByMonth = useMemo(() => {
    const map = {};
    data.expenses.forEach(e => {
      const m = e.date.slice(0, 7);
      map[m] = (map[m] || 0) + Number(e.amount);
    });
    return Object.entries(map).sort().slice(-6).map(([month, amount]) => ({ month, amount }));
  }, [data.expenses]);
  const invested = allocated.find(c => c.name === 'เงินลงทุน')?.amount || 0;
  const goalProgress = Math.min(100, data.goal > 0 ? (invested * data.months / data.goal) * 100 : 0);
  const fmt = n => money(n, data.currency);

  const addExpense = (e) => {
    e.preventDefault();
    const amount = Number(expenseAmount);
    if (!expenseName.trim() || !Number.isFinite(amount) || amount <= 0) return;
    update(p => ({ ...p, expenses: [{ id: Date.now(), name: expenseName.trim(), amount, date: expenseDate }, ...p.expenses] }));
    setExpenseName(''); setExpenseAmount('');
  };
  const removeExpense = id => update(p => ({ ...p, expenses: p.expenses.filter(e => e.id !== id) }));
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'smart-money-backup.json'; a.click();
    URL.revokeObjectURL(url);
  };
  const reset = () => {
    if (window.confirm('ต้องการคืนค่าตัวอย่างเริ่มต้นหรือไม่? ข้อมูลที่บันทึกไว้จะถูกแทนที่')) {
      update(defaultState);
    }
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><Wallet size={22}/></div><div><b>Smart Money</b><small>PLANNER</small></div></div>
      <div className="nav-label">เมนูหลัก</div>
      {[['overview','ภาพรวม',LayoutDashboard],['daily','ใช้จ่ายรายวัน',CalendarDays],['budget','จัดสรรเงิน',CircleDollarSign],['expenses','รายจ่าย',Wallet],['goals','เป้าหมาย',Target]].map(([id,label,Icon]) =>
        <button key={id} className={'nav-item '+(tab===id?'active':'')} onClick={()=>setTab(id)}><Icon size={18}/>{label}</button>
      )}
      <div className="sidebar-note"><div className="note-icon"><PiggyBank size={19}/></div><b>วางแผนวันนี้</b><p>เพื่อเป้าหมายทางการเงินในวันข้างหน้า</p></div>
      <small className="local-note">{({loading:'กำลังโหลดข้อมูล…',saving:'กำลังบันทึก…',ok:'บันทึกบนคลาวด์แล้ว',error:'บันทึกบนคลาวด์ไม่สำเร็จ (เก็บในเครื่องไว้ก่อน)'})[sync]}</small><button className="nav-item" onClick={()=>signOut(auth)}><LogOut size={18}/>ออกจากระบบ</button>
    </aside>

    <main className="main">
      <header className="topbar"><div><span className="eyebrow">PERSONAL FINANCE</span><h1>{({overview:'ภาพรวมการเงิน',daily:'งบใช้จ่ายรายวัน',budget:'จัดสรรรายได้',expenses:'บันทึกรายจ่าย',goals:'เป้าหมายการเงิน'})[tab]}</h1></div>
        <div className="top-actions"><span className="currency-pill">{data.currency}</span><button className="icon-button" title="ส่งออกข้อมูล" onClick={exportData}><Download size={18}/></button></div>
      </header>

      {tab==='overview' && <>
        <section className="welcome"><div><span className="welcome-tag">YOUR FINANCIAL SNAPSHOT</span><h2>จัดการเงินอย่างมีเป้าหมาย</h2><p>ดูภาพรวมรายได้ การใช้จ่าย และแผนสร้างเงินทุนของคุณในที่เดียว</p></div><div className="welcome-art"><div className="art-circle"><TrendingUp size={42}/></div></div></section>
        <section className="stats-grid">
          <Stat icon={Wallet} label="รายได้ต่อเดือน" value={fmt(data.income)} tone="blue"/>
          <Stat icon={TrendingUp} label="จัดสรรเพื่อลงทุน / เดือน" value={fmt(invested)} tone="purple"/>
          <Stat icon={PiggyBank} label="รายจ่ายที่บันทึกไว้" value={fmt(totalExpenses)} tone="orange"/>
          <Stat icon={Target} label="เป้าหมายเงินทุน" value={fmt(data.goal)} tone="green"/>
        </section>
        <section className="content-grid">
          <div className="panel"><div className="panel-heading"><div><h3>แผนจัดสรรรายได้</h3><p>แบ่งเงินจากรายได้ต่อเดือน</p></div><button className="text-button" onClick={()=>setTab('budget')}>แก้ไขแผน</button></div>
            <div className="chart-wrap"><ResponsiveContainer width="100%" height={230}><PieChart><Pie data={allocated} dataKey="amount" nameKey="name" innerRadius={65} outerRadius={92} paddingAngle={3}>{allocated.map((x,i)=><Cell key={i} fill={x.color}/>)}</Pie><Tooltip formatter={v=>fmt(v)}/></PieChart></ResponsiveContainer><div className="chart-center"><b>{totalPercent}%</b><span>จัดสรรแล้ว</span></div></div>
            <div className="legend">{allocated.map(c=><div className="legend-row" key={c.id}><span className="legend-name"><i style={{background:c.color}}/>{c.name}</span><b>{c.percent}%</b><span>{fmt(c.amount)}</span></div>)}</div>
          </div>
          <div className="panel"><div className="panel-heading"><div><h3>รายจ่ายรายเดือน</h3><p>จากรายการที่คุณบันทึก</p></div></div>
            {expenseByMonth.length ? <ResponsiveContainer width="100%" height={280}><BarChart data={expenseByMonth}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month" tick={{fontSize:11}}/><YAxis tick={{fontSize:10}}/><Tooltip formatter={v=>fmt(v)}/><Bar dataKey="amount" fill="#0ea5e9" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer> : <div className="empty-chart"><Wallet size={34}/><b>ยังไม่มีข้อมูลรายจ่าย</b><span>เพิ่มรายการเพื่อดูกราฟรายเดือน</span><button className="primary small" onClick={()=>setTab('expenses')}>เพิ่มรายจ่าย</button></div>}
          </div>
        </section>
        <div className="panel tip-panel"><div className="tip-icon"><Target size={21}/></div><div><b>คำแนะนำเบื้องต้น</b><p>{totalPercent!==100 ? `สัดส่วนการจัดสรรรวม ${totalPercent}% ควรปรับให้ครบ 100% ก่อนใช้แผนจริง` : 'ลองบันทึกรายจ่ายอย่างสม่ำเสมอ แล้วทบทวนแผนทุกสิ้นเดือน เงินสำรองฉุกเฉินควรเพียงพอต่อค่าใช้จ่ายจำเป็นหลายเดือน'}</p></div></div>
      </>}

      {tab==='daily' && <>
        <section className="stats-grid">
          <Stat icon={Wallet} label="รายรับเดือนนี้" value={fmt(daily.income)} tone="blue"/>
          <Stat icon={PiggyBank} label="รายจ่ายประจำรวม" value={fmt(fixedTotal)} tone="orange"/>
          <Stat icon={CircleDollarSign} label={`เหลือใช้ทั้งเดือน (${daily.dim} วัน)`} value={fmt(daily.budget)} tone="purple"/>
          <Stat icon={Target} label="ใช้ได้ต่อวัน" value={fmt(daily.perDay)} tone="green"/>
        </section>
        {daily.isCurrent && daily.today_ && <section className="panel today-panel"><span className="eyebrow">วันนี้</span><div className="big-number">{fmt(daily.today_.left)}</div><p className="muted">ยังใช้ได้อีกวันนี้ (ยอดสะสมรวมเงินที่เหลือจากวันก่อน {fmt(daily.today_.avail)} · ใช้แล้ววันนี้ {fmt(daily.today_.spent)})</p><p className="muted">เฉลี่ยต่อวันที่เหลือของเดือน (รวมวันนี้): <b>{fmt(daily.avgLeft)}</b> · คงเหลือทั้งเดือน <b className={daily.remaining<0?'warning':'good'}>{fmt(daily.remaining)}</b></p></section>}
        <div className="two-col">
          <div>
            <div className="panel"><h3>รายรับแต่ละเดือน</h3><p className="muted">เลือกเดือน แล้วกรอกรายรับที่ได้รับจริงของเดือนนั้น</p>
              <label className="field-label">เดือน</label><input className="field-input" type="month" value={month} onChange={e=>e.target.value&&setMonth(e.target.value)}/>
              <label className="field-label">รายรับของเดือนนี้ ({data.currency})</label><input className="field-input" type="number" min="0" value={monthIncomeInput} onChange={e=>setMonthIncomeInput(e.target.value)}/>
              <button className="primary" onClick={()=>update(p=>({...p,monthly:{...(p.monthly||{}),[month]:Math.max(0,Number(monthIncomeInput)||0)}}))}>บันทึกรายรับเดือนนี้</button>
              {Object.keys(data.monthly||{}).length>0 && <div className="summary-list" style={{marginTop:14}}>{Object.entries(data.monthly).sort().reverse().map(([m,v])=><div key={m}><span>{m}</span><b>{fmt(v)}</b></div>)}</div>}
              <p className="helper">ถ้าเดือนไหนไม่ได้กรอก ระบบใช้รายได้ต่อเดือนเริ่มต้น ({fmt(data.income)}) จากหน้าจัดสรรเงิน</p>
            </div>
            <div className="panel" style={{marginTop:18}}><h3>รายจ่ายประจำ (ตายตัวทุกเดือน)</h3><p className="muted">ค่าเช่า ค่าน้ำไฟ ค่าผ่อน ฯลฯ ตั้งครั้งเดียวใช้กับทุกเดือน</p>
              <form onSubmit={addFixed} className="expense-form"><label className="field-label">ชื่อรายการ</label><input className="field-input" required value={fixedName} onChange={e=>setFixedName(e.target.value)}/><label className="field-label">จำนวนเงินต่อเดือน ({data.currency})</label><input className="field-input" required type="number" min="1" value={fixedAmount} onChange={e=>setFixedAmount(e.target.value)}/><button className="primary" type="submit"><Plus size={17}/> เพิ่มรายจ่ายประจำ</button></form>
              {fixedList.length>0 && <div className="expense-list" style={{marginTop:12}}>{fixedList.map(f=><div className="expense-row" key={f.id}><div className="expense-dot"/><div className="expense-info"><b>{f.name}</b></div><strong>{fmt(f.amount)}</strong><button className="delete-button" title="ลบ" onClick={()=>removeFixed(f.id)}><Trash2 size={16}/></button></div>)}</div>}
            </div>
          </div>
          <div>
            <div className="panel"><h3>บันทึกการใช้เงิน</h3><p className="muted">ใช้ไปเท่าไหร่ กรอกตรงนี้ได้เลย (ไปอยู่ในหน้ารายจ่ายด้วย)</p>
              <form onSubmit={addExpense} className="expense-form"><label className="field-label">ชื่อรายการ</label><input className="field-input" required placeholder="เช่น ค่าอาหาร" value={expenseName} onChange={e=>setExpenseName(e.target.value)}/><label className="field-label">จำนวนเงิน ({data.currency})</label><input className="field-input" required type="number" min="1" value={expenseAmount} onChange={e=>setExpenseAmount(e.target.value)}/><label className="field-label">วันที่</label><input className="field-input" type="date" value={expenseDate} onChange={e=>setExpenseDate(e.target.value)}/><button className="primary" type="submit"><Plus size={17}/> เพิ่มรายการ</button></form>
            </div>
            <div className="panel" style={{marginTop:18}}><h3>รายวันของเดือน {month}</h3><p className="muted">เงินที่ไม่ได้ใช้ในแต่ละวันจะยกไปบวกวันถัดไป</p>
              {daily.rows.length ? <div className="tw"><table className="day-table"><thead><tr><th>วันที่</th><th>ใช้ได้ (สะสม)</th><th>ใช้ไป</th><th>เหลือยกไป</th></tr></thead><tbody>{daily.rows.map(r=><tr key={r.d}><td>{r.d}</td><td>{fmt(r.avail)}</td><td>{fmt(r.spent)}</td><td className={r.left<0?'warning':'good'}>{fmt(r.left)}</td></tr>)}</tbody></table></div> : <div className="empty-state">ยังไม่มีวันในเดือนนี้ที่นับถึง</div>}
            </div>
          </div>
        </div>
      </>}

      {tab==='budget' && <div className="two-col">
        <div className="panel"><div className="panel-heading"><div><h3>ตั้งค่ารายได้ต่อเดือน</h3><p>ระบุรายได้สุทธิหลังหักภาษีหรือรายการหักต่าง ๆ</p></div></div>
          <label className="field-label">รายได้ต่อเดือน ({data.currency})</label><input className="field-input" type="number" min="0" value={incomeInput} onChange={e=>setIncomeInput(e.target.value)}/>
          <button className="primary" onClick={()=>update(p=>({...p,income:Math.max(0,Number(incomeInput)||0)}))}>บันทึกรายได้</button>
          <div className="section-line"/>
          <div className="panel-heading"><div><h3>สัดส่วนการจัดสรร</h3><p>ปรับเปอร์เซ็นต์ให้เหมาะกับสถานการณ์ของคุณ</p></div><b className={totalPercent===100?'good':'warning'}>{totalPercent}% / 100%</b></div>
          {data.categories.map(c=><div className="allocation-edit" key={c.id}><div className="allocation-top"><span><i style={{background:c.color}}/>{c.name}</span><b>{c.percent}%</b></div><input aria-label={`เปอร์เซ็นต์ ${c.name}`} type="range" min="0" max="100" value={c.percent} onChange={e=>update(p=>({...p,categories:p.categories.map(x=>x.id===c.id?{...x,percent:Number(e.target.value)}:x)}))}/><div className="allocation-amount">{fmt(data.income*c.percent/100)}</div></div>)}
          <p className="helper">หมายเหตุ: เปอร์เซ็นต์รวมควรเท่ากับ 100% หากไม่ครบ ระบบจะแจ้งเตือน</p>
        </div>
        <div className="panel sticky-panel"><h3>สรุปแผนต่อเดือน</h3><p className="muted">คำนวณจากรายได้ล่าสุด</p><div className="big-number">{fmt(data.income)}</div><div className="summary-list">{allocated.map(c=><div key={c.id}><span>{c.name}</span><b>{fmt(c.amount)}</b></div>)}</div><div className={'status-box '+(totalPercent===100?'status-ok':'status-warn')}>{totalPercent===100?'สัดส่วนครบ 100% แล้ว':`ยังจัดสรรไม่ครบ ${100-totalPercent}%`}</div></div>
      </div>}

      {tab==='expenses' && <div className="two-col">
        <div className="panel"><h3>เพิ่มรายการรายจ่าย</h3><p className="muted">บันทึกค่าใช้จ่ายเพื่อดูพฤติกรรมการใช้เงิน</p><form onSubmit={addExpense} className="expense-form"><label className="field-label">ชื่อรายการ</label><input className="field-input" required placeholder="เช่น ค่าอาหาร ค่าเดินทาง" value={expenseName} onChange={e=>setExpenseName(e.target.value)}/><label className="field-label">จำนวนเงิน ({data.currency})</label><input className="field-input" required type="number" min="1" placeholder="0" value={expenseAmount} onChange={e=>setExpenseAmount(e.target.value)}/><label className="field-label">วันที่</label><input className="field-input" type="date" value={expenseDate} onChange={e=>setExpenseDate(e.target.value)}/><button className="primary" type="submit"><Plus size={17}/> เพิ่มรายการ</button></form></div>
        <div className="panel"><div className="panel-heading"><div><h3>รายการที่บันทึก</h3><p>{data.expenses.length} รายการ · รวม {fmt(totalExpenses)}</p></div></div>{data.expenses.length ? <div className="expense-list">{data.expenses.map(e=><div className="expense-row" key={e.id}><div className="expense-dot"/><div className="expense-info"><b>{e.name}</b><span>{e.date}</span></div><strong>{fmt(e.amount)}</strong><button className="delete-button" title="ลบรายการ" onClick={()=>removeExpense(e.id)}><Trash2 size={16}/></button></div>)}</div>:<div className="empty-state">ยังไม่มีรายการรายจ่าย</div>}</div>
      </div>}

      {tab==='goals' && <div className="goal-layout"><div className="panel"><div className="goal-icon"><Target size={28}/></div><h3>วางแผนเป้าหมายเงินทุน</h3><p className="muted">คำนวณเงินลงทุนสะสมแบบไม่รวมผลตอบแทน</p><label className="field-label">จำนวนเงินเป้าหมาย ({data.currency})</label><input className="field-input" type="number" min="1" value={goalInput} onChange={e=>setGoalInput(e.target.value)}/><label className="field-label">ระยะเวลา (เดือน)</label><input className="field-input" type="number" min="1" value={monthsInput} onChange={e=>setMonthsInput(e.target.value)}/><button className="primary" onClick={()=>{const g=Math.max(1,Number(goalInput)||1),m=Math.max(1,Number(monthsInput)||1);update(p=>({...p,goal:g,months:m}));}}>คำนวณเป้าหมาย</button></div>
        <div className="panel goal-result"><span className="eyebrow">YOUR SAVING PROJECTION</span><h3>ภาพรวมเป้าหมาย</h3><div className="goal-number">{fmt(data.goal)}</div><p className="muted">เป้าหมายใน {data.months} เดือน</p><div className="progress-track"><div style={{width:goalProgress+'%'}}/></div><div className="progress-meta"><span>เงินลงทุนตามแผน {fmt(invested*data.months)}</span><b>{goalProgress.toFixed(1)}%</b></div><div className="goal-callout"><span>ต้องเก็บเฉลี่ยต่อเดือน</span><b>{fmt(data.goal/data.months)}</b></div><p className="helper">ประมาณการนี้ใช้เงินลงทุนรายเดือนปัจจุบันคูณจำนวนเดือน ไม่รวมดอกเบี้ย ผลตอบแทน ภาษี หรือความผันผวนของสินทรัพย์</p></div></div>}

      <footer><span>Smart Money Planner · เวอร์ชันเริ่มต้น 1.0</span><button className="reset-button" onClick={reset}><RotateCcw size={14}/> คืนค่าตัวอย่าง</button></footer>
    </main>
  </div>;
}

function Stat({icon:Icon,label,value,tone}) { return <div className="stat-card"><div className={'stat-icon '+tone}><Icon size={20}/></div><span>{label}</span><b>{value}</b><small>ตามข้อมูลที่บันทึกไว้</small></div>; }

function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { await signInWithEmailAndPassword(auth, email.trim(), pw); }
    catch { setErr('อีเมลหรือรหัสผ่านไม่ถูกต้อง'); }
  };
  return <div className="login-wrap"><form className="panel login-card" onSubmit={submit}>
    <h3>Smart Money Planner</h3><p className="muted">เข้าสู่ระบบเพื่อดูข้อมูลของคุณจากทุกเครื่อง</p>
    <label className="field-label">อีเมล</label><input className="field-input" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/>
    <label className="field-label">รหัสผ่าน</label><input className="field-input" type="password" autoComplete="current-password" required value={pw} onChange={e=>setPw(e.target.value)}/>
    <button className="primary" type="submit">เข้าสู่ระบบ</button>{err && <p className="warning">{err}</p>}
  </form></div>;
}

export default function App() {
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (user === undefined) return <div className="login-wrap">กำลังโหลด…</div>;
  if (!user) return <Login />;
  return <Planner key={user.uid} />;
}
