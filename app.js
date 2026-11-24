const SUPABASE_URL = window.OMS_CONFIG?.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = window.OMS_CONFIG?.SUPABASE_ANON_KEY || "";
const TEAM = ["Prafinda", "Ahzka"];

let db = null, currentUser = null, schedules = [], calendarDate = new Date(), selectedDate = null;
const $ = (id) => document.getElementById(id);
const loginView = $("loginView"), appView = $("appView"), dialog = $("scheduleDialog");

function configured(){
 return SUPABASE_URL.startsWith("https://")
   && !SUPABASE_URL.includes("PASTE_YOUR")
   && Boolean(SUPABASE_ANON_KEY)
   && !SUPABASE_ANON_KEY.includes("PASTE_YOUR");
}

function toast(message){
 const el=$("toast");
 el.textContent=message;
 el.classList.add("show");
 setTimeout(()=>el.classList.remove("show"),2600);
}

function fmtDate(value, opts={day:"2-digit",month:"short",year:"numeric"}){
 return new Intl.DateTimeFormat("id-ID",opts).format(new Date(value+"T12:00:00"));
}

function dateOnly(d){
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function monthValue(d){
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function typeFromDate(value){
 const day=new Date(value+"T12:00:00").getDay();
 return day===0||day===6?"Weekend":"Weekdays";
}

function escapeHTML(s=""){
 return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function showApp(user){
 currentUser=user;
 loginView.classList.add("hidden");
 appView.classList.remove("hidden");
 const email=user.email||"";
 const prefix=email.split("@")[0];
 const name=/ahzka/i.test(prefix)?"Ahzka":/prafinda/i.test(prefix)?"Prafinda":prefix;
 $("userName").textContent=name;
 $("userEmail").textContent=email;
 $("userAvatar").textContent=name.charAt(0).toUpperCase();
}

function showLogin(message=""){
 appView.classList.add("hidden");
 loginView.classList.remove("hidden");
 $("loginMessage").textContent=message;
}

async function loadSchedules(){
 const {data,error}=await db.from("overtime_schedules").select("*").order("overtime_date",{ascending:true});
 if(error){toast("Gagal memuat data: "+error.message);return;}
 schedules=data||[];
 renderAll();
}

function selectedMonth(){
 return $("dashboardMonth").value || monthValue(new Date());
}

function inMonth(item, month){
 return item.overtime_date.startsWith(month);
}

function renderDashboard(){
 const month=selectedMonth(), list=schedules.filter(x=>inMonth(x,month));
 $("totalStat").textContent=list.length;
 $("prafindaStat").textContent=list.filter(x=>x.member==="Prafinda").length;
 $("ahzkaStat").textContent=list.filter(x=>x.member==="Ahzka").length;
 const wk=list.filter(x=>x.overtime_type==="Weekend").length;
 $("weekendStat").textContent=wk;
 $("weekendCount").textContent=wk;
 $("weekdayCount").textContent=list.length-wk;
 const max=Math.max(1,list.length);
 $("weekdayBar").style.width=((list.length-wk)/max*100)+"%";
 $("weekendBar").style.width=(wk/max*100)+"%";
 renderCalendar();
 const upcoming=schedules.filter(x=>x.overtime_date>=dateOnly(new Date())).slice(0,5);
 $("upcomingList").innerHTML=upcoming.length?upcoming.map(x=>`<div class="upcoming-item"><div class="date-tile"><strong>${new Date(x.overtime_date+"T12:00:00").getDate()}</strong><small>${fmtDate(x.overtime_date,{month:"short"})}</small></div><div class="upcoming-info"><strong>${escapeHTML(x.member)} <span class="tag ${x.overtime_type==="Weekend"?"weekend":""}">${escapeHTML(x.overtime_type)}</span></strong><p>${escapeHTML(x.agenda)}</p></div></div>`).join(""):'<div class="empty-state">Belum ada jadwal lembur mendatang.</div>';
}

function renderCalendar(){
 const year=calendarDate.getFullYear(), month=calendarDate.getMonth();
 $("calendarLabel").textContent=new Intl.DateTimeFormat("id-ID",{month:"long",year:"numeric"}).format(calendarDate);
 const first=new Date(year,month,1), start=(first.getDay()+6)%7, days=new Date(year,month+1,0).getDate(), prevDays=new Date(year,month,0).getDate();
 const labels=["Sen","Sel","Rab","Kam","Jum","Sab","Min"];
 let html=labels.map(x=>`<div class="weekday">${x}</div>`).join("");
 for(let i=0;i<42;i++){
  let n=i-start+1, d, outside=false;
  if(n<1){d=new Date(year,month-1,prevDays+n);outside=true;}
  else if(n>days){d=new Date(year,month+1,n-days);outside=true;}
  else d=new Date(year,month,n);
  const key=dateOnly(d), items=schedules.filter(x=>x.overtime_date===key), today=key===dateOnly(new Date()), selected=key===selectedDate;
  html+=`<button class="day-cell ${outside?"outside":""} ${today?"today":""} ${selected?"selected":""}" data-date="${key}" type="button"><span class="day-number">${d.getDate()}</span><span class="day-dots">${items.map(x=>`<i class="${x.member==="Prafinda"?"pra":"ahz"}" title="${escapeHTML(x.member)}"></i>`).join("")}</span></button>`;
 }
 $("calendarGrid").innerHTML=html;
 $("calendarGrid").querySelectorAll("[data-date]").forEach(b=>b.addEventListener("click",()=>{
  selectedDate=b.dataset.date;
  renderCalendar();
  const dayItems=schedules.filter(x=>x.overtime_date===selectedDate);
  if(dayItems.length){toast(dayItems.map(x=>x.member+": "+x.agenda).join(" | "));}
  else toast("Tidak ada agenda pada tanggal ini.");
 }));
}

function renderTable(){
 const q=$("searchInput").value.trim().toLowerCase(), member=$("memberFilter").value, type=$("typeFilter").value, month=$("listMonth").value;
 const list=schedules.filter(x=>(!q||(x.agenda+" "+x.member).toLowerCase().includes(q))&&(!member||x.member===member)&&(!type||x.overtime_type===type)&&(!month||inMonth(x,month)));
 $("scheduleRows").innerHTML=list.length?list.map(x=>`<tr><td>${fmtDate(x.overtime_date)}</td><td><span class="member-pill ${x.member==="Ahzka"?"ahzka":""}"><i></i>${escapeHTML(x.member)}</span></td><td><span class="tag ${x.overtime_type==="Weekend"?"weekend":""}">${escapeHTML(x.overtime_type)}</span></td><td class="agenda-cell">${escapeHTML(x.agenda)}</td><td><div class="row-actions"><button class="text-btn" data-edit="${x.id}">Edit</button><button class="text-btn delete" data-delete="${x.id}">Delete</button></div></td></tr>`).join(""):'<tr><td colspan="5" class="empty-state">Tidak ada jadwal yang cocok.</td></tr>';
 $("scheduleRows").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>openForm(schedules.find(x=>String(x.id)===b.dataset.edit))));
 $("scheduleRows").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteSchedule(b.dataset.delete)));
}

function renderAll(){
 renderDashboard();
 renderTable();
}

function openForm(item=null){
 $("scheduleForm").reset();
 $("scheduleId").value=item?.id||"";
 $("dialogTitle").textContent=item?"Edit schedule":"Add schedule";
 $("scheduleDate").value=item?.overtime_date||dateOnly(new Date());
 $("scheduleMember").value=item?.member||"";
 $("scheduleType").value=item?.overtime_type||typeFromDate($("scheduleDate").value);
 $("scheduleAgenda").value=item?.agenda||"";
 $("formMessage").textContent="";
 dialog.showModal();
}

async function saveForm(e){
 e.preventDefault();
 const id=$("scheduleId").value;
 const payload={
  overtime_date:$("scheduleDate").value,
  member:$("scheduleMember").value,
  overtime_type:$("scheduleType").value,
  agenda:$("scheduleAgenda").value.trim(),
  updated_at:new Date().toISOString()
 };
 if(!payload.overtime_date||!TEAM.includes(payload.member)||!["Weekdays","Weekend"].includes(payload.overtime_type)||!payload.agenda){
  $("formMessage").textContent="Lengkapi semua data.";
  return;
 }
 $("saveSchedule").disabled=true;
 const query=id?db.from("overtime_schedules").update(payload).eq("id",id):db.from("overtime_schedules").insert({...payload,created_by:currentUser.id});
 const {error}=await query;
 $("saveSchedule").disabled=false;
 if(error){$("formMessage").textContent=error.message;return;}
 dialog.close();
 toast(id?"Jadwal berhasil diperbarui.":"Jadwal berhasil ditambahkan.");
 await loadSchedules();
}

async function deleteSchedule(id){
 if(!confirm("Hapus jadwal lembur ini?"))return;
 const {error}=await db.from("overtime_schedules").delete().eq("id",id);
 if(error){toast("Gagal menghapus: "+error.message);return;}
 toast("Jadwal dihapus.");
 await loadSchedules();
}

function switchPage(page){
 $("dashboardPage").classList.toggle("hidden",page!=="dashboard");
 $("schedulesPage").classList.toggle("hidden",page!=="schedules");
 $("pageTitle").textContent=page==="dashboard"?"Dashboard":"Overtime Schedule";
 document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
}

async function init(){
 if(!configured()){
  showLogin("Konfigurasi Supabase belum terbaca. Periksa config.js dan pastikan file tersebut dimuat sebelum app.js.");
  $("loginForm").addEventListener("submit",e=>{
   e.preventDefault();
   $("loginMessage").textContent="Periksa Project URL dan Publishable Key di config.js terlebih dahulu.";
  });
  return;
 }
 db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
 const {data:{session}}=await db.auth.getSession();
 if(session){showApp(session.user);await loadSchedules();}
 else showLogin();
 db.auth.onAuthStateChange(async(_event,session)=>{
  if(session){showApp(session.user);await loadSchedules();}
  else showLogin();
 });
 $("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  $("loginMessage").textContent="";
  const {error}=await db.auth.signInWithPassword({email:$("email").value,password:$("password").value});
  if(error)$("loginMessage").textContent=error.message;
 });
 $("logoutBtn").addEventListener("click",async()=>{
  await db.auth.signOut();
 });
}

$("scheduleForm").addEventListener("submit",saveForm);
$("scheduleDate").addEventListener("change",()=>{
 $("scheduleType").value=typeFromDate($("scheduleDate").value);
});
$("closeDialog").addEventListener("click",()=>dialog.close());
$("cancelDialog").addEventListener("click",()=>dialog.close());
$("quickAdd").addEventListener("click",()=>openForm());
$("addSchedule").addEventListener("click",()=>openForm());
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>switchPage(b.dataset.page)));
$("dashboardMonth").value=monthValue(new Date());
$("listMonth").value="";
$("dashboardMonth").addEventListener("change",renderDashboard);
$("prevMonth").addEventListener("click",()=>{
 calendarDate.setMonth(calendarDate.getMonth()-1);
 renderCalendar();
});
$("nextMonth").addEventListener("click",()=>{
 calendarDate.setMonth(calendarDate.getMonth()+1);
 renderCalendar();
});
["searchInput","memberFilter","typeFilter","listMonth"].forEach(id=>$(id).addEventListener("input",renderTable));

init();
