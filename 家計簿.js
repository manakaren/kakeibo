// === 定数・初期設定 ===
const LS = {
  TRANS: "kakeibo.trans",
  BUDGET: "kakeibo.budget",
  GOAL_YEAR: "kakeibo.goal_year",
  GOAL_18: "kakeibo.goal_18",
  REPORTS: "kakeibo.reports",
  SAVINGS: "kakeibo.savings"
};
const $ = (s) => document.querySelector(s);

let transactions = JSON.parse(localStorage.getItem(LS.TRANS) || "[]");
let budget = +localStorage.getItem(LS.BUDGET) || 100000;
let goalYear = +localStorage.getItem(LS.GOAL_YEAR) || 900000;
let goal18 = +localStorage.getItem(LS.GOAL_18) || 1250000;
let savings = +localStorage.getItem(LS.SAVINGS) || 0;
const reports = JSON.parse(localStorage.getItem(LS.REPORTS) || "[]");

// === 取引追加 ===
$("#entry-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const t = {
    date: $("#date").value || new Date().toISOString().slice(0, 10),
    type: $("#type").value,
    category: $("#category").value.trim(),
    amount: +$("#amount").value,
    memo: $("#memo").value.trim(),
    repeat: $("#repeat").checked,
    saved: false
  };
  if (!t.category || !t.amount) return alert("入力不足です");
  transactions.push(t);
  saveAll();
  renderAll();
  e.target.reset();
});

// === 削除 ===
function delTrans(i) {
  const t = transactions[i];
  if (t.saved) {
    if (confirm("この取引は貯金に追加済みです。貯金からも削除しますか？")) {
      savings -= t.amount;
      if (savings < 0) savings = 0;
      localStorage.setItem(LS.SAVINGS, savings);
    }
  }
  transactions.splice(i, 1);
  saveAll();
  renderAll();
}

// === 繰り返し追加（月初） ===
function addRepeats() {
  const today = new Date().toISOString().slice(0, 10);
  const ym = today.slice(0, 7);
  const repeats = transactions.filter(t => t.repeat);
  for (const r of repeats) {
    const exists = transactions.some(t => t.repeat && t.date.startsWith(ym) && t.category === r.category);
    if (!exists) transactions.push({ ...r, date: `${ym}-01` });
  }
}

// === 保存 ===
function saveAll() {
  localStorage.setItem(LS.TRANS, JSON.stringify(transactions));
  localStorage.setItem(LS.BUDGET, budget);
  localStorage.setItem(LS.GOAL_YEAR, goalYear);
  localStorage.setItem(LS.GOAL_18, goal18);
  localStorage.setItem(LS.SAVINGS, savings);
}

// === 目標・予算変更 ===
$("#goal-year").oninput = e => { goalYear = +e.target.value; saveAll(); renderProgress(); };
$("#goal-18").oninput = e => { goal18 = +e.target.value; saveAll(); renderProgress(); };
$("#budget").value = budget;
$("#budget").oninput = e => { budget = +e.target.value; saveAll(); renderAll(); };

// === 貯金リセット ===
$("#reset-savings").addEventListener("click", () => {
  if (!confirm("貯金データをすべてリセットしますか？")) return;
  savings = 0;
  localStorage.setItem(LS.SAVINGS, savings);
  renderProgress();
  alert("💣 貯金データをリセットしました。");
});

// === 今日の取引一覧 ===
function renderToday() {
  const today = new Date().toISOString().slice(0, 10);
  const tbody = $("#today-table tbody");
  tbody.innerHTML = "";
  const todayList = transactions.filter(t => t.date === today);
  todayList.forEach(t => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${t.type === "income" ? "収入" : "支出"}</td>
                    <td>${t.category}</td>
                    <td>${t.amount.toLocaleString()}</td>
                    <td>${t.memo || ""}</td>`;
    tbody.appendChild(tr);
  });
  if (todayList.length === 0) tbody.innerHTML = `<tr><td colspan="4">本日の取引はありません</td></tr>`;
}

// === 全取引テーブル ===
function renderTransactions() {
  const tbody = $("#trans-table tbody");
  tbody.innerHTML = "";
  transactions.forEach((t, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.date}</td>
      <td>${t.type === "income" ? "収入" : "支出"}</td>
      <td>${t.category}</td>
      <td>${t.amount.toLocaleString()}</td>
      <td>${t.memo || ""}</td>
      <td>
        <button class="btn small" onclick="delTrans(${i})">削除</button>
        <button class="btn small primary" onclick="addToSavings(${i})">💰貯金追加</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

// === 貯金追加機能 ===
function addToSavings(i) {
  const t = transactions[i];
  if (t.type === "expense") return alert("支出は貯金に追加できません！");
  if (!confirm(`「${t.category}」の ${t.amount.toLocaleString()}円 を貯金に加えますか？`)) return;
  if (t.saved) return alert("この取引はすでに貯金に追加済みです。");
  t.saved = true;
  savings += t.amount;
  saveAll();
  alert(`💰 ${t.amount.toLocaleString()}円 を貯金に追加しました！`);
  renderProgress();
}

// === 予算・収支判定 ===
function renderBudgetAlert() {
  const month = new Date().toISOString().slice(0, 7);
  const inc = transactions.filter(t => t.type === "income" && t.date.startsWith(month))
                          .reduce((a,b)=>a+b.amount,0);
  const exp = transactions.filter(t => t.type === "expense" && t.date.startsWith(month))
                          .reduce((a,b)=>a+b.amount,0);
  const bal = inc - exp;
  $("#balance-result").textContent = bal >= 0 ? `今月は黒字：${bal.toLocaleString()}円` :
                                      `今月は赤字：${bal.toLocaleString()}円`;
  const el = $("#budget-alert");
  if (exp > budget)
    el.textContent = `⚠️ 支出 ${exp.toLocaleString()}円 が予算 ${budget.toLocaleString()}円 超過`;
  else
    el.textContent = `支出 ${exp.toLocaleString()}円 / 予算 ${budget.toLocaleString()}円`;
}

// === グラフ ===
let pieChart, lineChart, barChart;
function renderCharts() {
  const cats = {};
  transactions.filter(t=>t.type==="expense")
              .forEach(t=>cats[t.category]=(cats[t.category]||0)+t.amount);
  const ctx1 = $("#pieChart");
  if(pieChart) pieChart.destroy();
  pieChart = new Chart(ctx1,{type:"pie",data:{labels:Object.keys(cats),
                datasets:[{data:Object.values(cats),
                backgroundColor:["#c0392b","#d35400","#27ae60","#2980b9","#8e44ad","#f1c40f"]}]}});

  const months={}, monthInc={}, monthExp={};
  transactions.forEach(t=>{
    const ym=t.date.slice(0,7);
    if(t.type==="income") monthInc[ym]=(monthInc[ym]||0)+t.amount;
    if(t.type==="expense") monthExp[ym]=(monthExp[ym]||0)+t.amount;
  });
  const keys=[...new Set([...Object.keys(monthInc),...Object.keys(monthExp)])].sort();
  const net=keys.map(k=>(monthInc[k]||0)-(monthExp[k]||0));
  const ctx2=$("#lineChart");
  if(lineChart) lineChart.destroy();
  lineChart=new Chart(ctx2,{type:"line",data:{
    labels:keys,
    datasets:[
      {label:"収入",data:keys.map(k=>monthInc[k]||0),borderColor:"#27ae60"},
      {label:"支出",data:keys.map(k=>monthExp[k]||0),borderColor:"#e74c3c"},
      {label:"貯金増減",data:net,borderColor:"#2980b9"}
    ]}});

  const actual=keys.map(k=>monthExp[k]||0);
  const budgets=keys.map(()=>budget);
  const colors=actual.map(a=>a>budget?"#e74c3c":"#2ecc71");
  const ctx3=$("#barChart");
  if(barChart) barChart.destroy();
  barChart=new Chart(ctx3,{type:"bar",
    data:{labels:keys,datasets:[
      {label:"支出実績",data:actual,backgroundColor:colors},
      {label:"月予算",data:budgets,backgroundColor:"#95a5a6"}]},
    options:{scales:{y:{beginAtZero:true}}}});
}

// === 貯金進捗バー ===
function renderProgress(){
  const now=new Date(), today=now.toISOString().slice(0,10);
  const calc=(from,to)=>transactions.filter(t=>t.date>=from&&t.date<=to)
    .reduce((a,b)=>a+(b.type==="income"?b.amount:-b.amount),0);
  const yearStart=`${now.getFullYear()}-01-01`;
  const year=calc(yearStart,today)+savings;
  const m18=new Date(); m18.setMonth(m18.getMonth()-18);
  const last18=calc(m18.toISOString().slice(0,10),today)+savings;
  const month=calc(`${today.slice(0,7)}-01`,today)+savings;
  setBar($("#year-bar"),$("#year-pct"),year/goalYear*100);
  setBar($("#m18-bar"),$("#m18-pct"),last18/goal18*100);
  setBar($("#mon-bar"),$("#mon-pct"),month/budget*100);
}
function setBar(el,pctEl,pct){
  const p=Math.max(0,Math.min(100,Math.round(pct)));
  el.style.width=p+"%";
  el.className="bar-fill";
  if(p>=70) el.classList.add("good");
  else if(p>=40) el.classList.add("warn");
  else el.classList.add("bad");
  pctEl.textContent=p+"%";
}

// === 報告書 ===
$("#report-form").addEventListener("submit",(e)=>{
  e.preventDefault();
  const r={
    month:$("#rep-month").value,
    name:$("#rep-name").value,
    app:+$("#rep-app").value||0,
    cond:+$("#rep-cond").value||0,
    med:$("#rep-med").value,
    health:$("#rep-health").value,
    meet:$("#rep-meet").value,
    out:$("#rep-out").value,
    goal:$("#rep-goal").value,
    staff:$("#rep-staff").value,
    parent:$("#rep-parent").value,
    signStaff:$("#sign-staff").value,
    signParent:$("#sign-parent").value
  };
  reports.push(r);
  localStorage.setItem(LS.REPORTS,JSON.stringify(reports));
  renderReports();
  e.target.reset();
});

function renderReports(){
  const ul=$("#rep-list");
  ul.innerHTML="";
  reports.forEach((r,i)=>{
    const li=document.createElement("li");
    li.innerHTML=`<strong>${r.month}</strong> ${r.name||"（未記入）"}  
      応募${r.app}件 / 体調${r.cond}/10
      <br>面談:${r.meet?"あり":"なし"} 医療:${r.med?"あり":"なし"}  
      保護者:${r.signParent||"未確認"}
      <br><button class="btn small danger" onclick="deleteReport(${i})">削除</button>`;
    ul.appendChild(li);
  });
}

function deleteReport(i){
  if(!confirm("この報告書を削除しますか？"))return;
  reports.splice(i,1);
  localStorage.setItem(LS.REPORTS,JSON.stringify(reports));
  renderReports();
}

// === テーマ切替・印刷 ===
$("#theme-toggle").onclick=()=>document.body.classList.toggle("dark");
$("#print-all").onclick=()=>window.print();

// === 初期描画 ===
function renderAll(){
  addRepeats();
  renderToday();
  renderTransactions();
  renderBudgetAlert();
  renderCharts();
  renderProgress();
  renderReports();
}
renderAll();
