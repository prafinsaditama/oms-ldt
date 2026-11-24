const SUPABASE_URL = window.OMS_CONFIG?.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = window.OMS_CONFIG?.SUPABASE_ANON_KEY || "";
const TEAM = ["Prafinda", "Ahzka"];

let db = null, currentUser = null, schedules = [], calendarDate = new Date(), selectedDate = null;
let datePickerMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedDates = new Set();
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

function isReimbursementEligible(item){ return item.overtime_type === "Weekdays" && item.work_location === "WFH"; }
function reimbursementLabel(item){
 if(!isReimbursementEligible(item)) return "N/A";
 const labels={not_submitted:"Belum Diajukan",processing:"Proses",done:"Done"};
 return labels[item.reimbursement_status||"not_submitted"]||"Belum Diajukan";
}
function renderOvertimeAnalytics(){
 const eligibleRows=schedules.filter(isReimbursementEligible);
 $("reimbNotSubmitted").textContent=eligibleRows.filter(x=>(x.reimbursement_status||"not_submitted")==="not_submitted").length;
 $("reimbProcessing").textContent=eligibleRows.filter(x=>x.reimbursement_status==="processing").length;
 $("reimbDone").textContent=eligibleRows.filter(x=>x.reimbursement_status==="done").length;
 const weekdayTotal=schedules.filter(x=>x.overtime_type==="Weekdays").length;
 const weekendTotal=schedules.filter(x=>x.overtime_type==="Weekend").length;
 $("analyticsWeekdaysTotal").textContent=weekdayTotal;
 $("analyticsWeekendTotal").textContent=weekendTotal;
 $("analyticsGrandTotal").textContent=weekdayTotal+weekendTotal;
 const chart=$("overtimeChart");
 if(!schedules.length){
  chart.innerHTML='<div class="analytics-empty">Belum ada data lembur untuk ditampilkan.</div>';
  return;
 }
 const counts=new Map();
 schedules.forEach(item=>{
  const month=item.overtime_date.slice(0,7);
  if(!counts.has(month))counts.set(month,{Weekdays:0,Weekend:0});
  const row=counts.get(month);
  if(item.overtime_type==="Weekdays"||item.overtime_type==="Weekend")row[item.overtime_type]++;
 });
 const keys=[...counts.keys()].sort();
 const first=new Date(keys[0]+"-01T12:00:00");
 const last=new Date(keys[keys.length-1]+"-01T12:00:00");
 const months=[];
 for(let cursor=new Date(first);cursor<=last;cursor.setMonth(cursor.getMonth()+1)){
  const key=monthValue(cursor);
  months.push({key,label:new Intl.DateTimeFormat("id-ID",{month:"short",year:"2-digit"}).format(cursor),...(counts.get(key)||{Weekdays:0,Weekend:0})});
 }
 const max=Math.max(1,...months.flatMap(x=>[x.Weekdays,x.Weekend]));
 const width=Math.max(620,months.length*76+56), height=260, top=22, bottom=45, plotH=height-top-bottom;
 const groupW=(width-48)/months.length, barW=Math.min(20,groupW*.27);
 const grid=[];
 for(let tick=0;tick<=4;tick++){
  const value=Math.ceil(max*tick/4), y=top+plotH-(plotH*tick/4);
  grid.push(`<line x1="36" y1="${y}" x2="${width-12}" y2="${y}" class="chart-gridline"/><text x="28" y="${y+4}" text-anchor="end" class="chart-y-label">${value}</text>`);
 }
 const bars=months.map((m,i)=>{
  const center=44+i*groupW+groupW/2;
  const h1=m.Weekdays/max*plotH, h2=m.Weekend/max*plotH;
  const y1=top+plotH-h1, y2=top+plotH-h2;
  return `<rect x="${center-barW-2}" y="${y1}" width="${barW}" height="${Math.max(0,h1)}" rx="4" class="chart-bar-weekdays"><title>${m.label}: Weekdays ${m.Weekdays}</title></rect><rect x="${center+2}" y="${y2}" width="${barW}" height="${Math.max(0,h2)}" rx="4" class="chart-bar-weekend"><title>${m.label}: Weekend ${m.Weekend}</title></rect><text x="${center}" y="${height-17}" text-anchor="middle" class="chart-x-label">${escapeHTML(m.label)}</text>`;
 }).join("");
 chart.innerHTML=`<div class="chart-scroll"><svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Grafik batang bulanan Weekdays dan Weekend">${grid.join("")}${bars}</svg></div>`;
}

function renderTable(){
 const q=$("searchInput").value.trim().toLowerCase(), member=$("memberFilter").value, type=$("typeFilter").value, month=$("listMonth").value;
 const list=schedules.filter(x=>(!q||(x.agenda+" "+x.member).toLowerCase().includes(q))&&(!member||x.member===member)&&(!type||x.overtime_type===type)&&(!month||inMonth(x,month)));
 $("scheduleRows").innerHTML=list.length?list.map(x=>`<tr><td>${fmtDate(x.overtime_date)}</td><td><span class="member-pill ${x.member==="Ahzka"?"ahzka":""}"><i></i>${escapeHTML(x.member)}</span></td><td><span class="tag ${x.overtime_type==="Weekend"?"weekend":""}">${escapeHTML(x.overtime_type)}</span></td><td><span class="location-pill">${escapeHTML(x.work_location||"Belum diisi")}</span></td><td class="agenda-cell">${escapeHTML(x.agenda)}</td><td><span class="reimbursement-pill">${reimbursementLabel(x)}</span>${isReimbursementEligible(x)&&x.reimbursement_submitted_at?`<small class="table-subtext">Ajukan: ${fmtDate(x.reimbursement_submitted_at)}</small>`:""}${x.reimbursement_status==="done"&&x.reimbursement_received_at?`<small class="table-subtext">Terima: ${fmtDate(x.reimbursement_received_at)}</small>`:""}</td><td><div class="row-actions"><button class="text-btn" data-edit="${x.id}">Edit</button><button class="text-btn delete" data-delete="${x.id}">Delete</button></div></td></tr>`).join(""):'<tr><td colspan="7" class="empty-state">Tidak ada jadwal yang cocok.</td></tr>';
 $("scheduleRows").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>openForm(schedules.find(x=>String(x.id)===b.dataset.edit))));
 $("scheduleRows").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteSchedule(b.dataset.delete)));
}

function renderAll(){
 renderDashboard();
 renderTable();
 renderOvertimeAnalytics();
}

function sortedSelectedDates(){
 return [...selectedDates].sort();
}

function selectedMembers(){
 return [...document.querySelectorAll('input[name="scheduleMembers"]:checked')].map(input=>input.value);
}

function updateBulkPreview(){
 const dates=sortedSelectedDates();
 const members=selectedMembers();
 const count=dates.length*members.length;
 $("dateSelectionCount").textContent=`${dates.length} tanggal dipilih`;
 $("memberSelectionCount").textContent=members.length?`${members.length} anggota dipilih`:"Pilih satu atau kedua anggota.";
 $("bulkPreview").classList.toggle("hidden",!dates.length&&!members.length);
 if(dates.length&&members.length){
  $("bulkPreview").textContent=`${dates.length} tanggal × ${members.length} anggota = ${count} jadwal akan dibuat.`;
 }else if(dates.length||members.length){
  $("bulkPreview").textContent="Pilih tanggal dan anggota untuk melihat jumlah jadwal.";
 }else{
  $("bulkPreview").textContent="";
 }
}

function renderDatePicker(){
 const year=datePickerMonth.getFullYear(), month=datePickerMonth.getMonth();
 $("datePickerMonth").textContent=new Intl.DateTimeFormat("id-ID",{month:"long",year:"numeric"}).format(datePickerMonth);
 const first=new Date(year,month,1), start=(first.getDay()+6)%7;
 const days=new Date(year,month+1,0).getDate();
 const prevDays=new Date(year,month,0).getDate();
 const labels=["Sen","Sel","Rab","Kam","Jum","Sab","Min"];
 let html=labels.map(label=>`<div class="picker-weekday">${label}</div>`).join("");
 for(let i=0;i<42;i++){
  const n=i-start+1;
  let day, outside=false;
  if(n<1){day=new Date(year,month-1,prevDays+n);outside=true;}
  else if(n>days){day=new Date(year,month+1,n-days);outside=true;}
  else day=new Date(year,month,n);
  const key=dateOnly(day), chosen=selectedDates.has(key), today=key===dateOnly(new Date());
  html+=`<button type="button" class="picker-day ${outside?"outside":""} ${chosen?"chosen":""} ${today?"today":""}" data-pick-date="${key}" aria-pressed="${chosen}">${day.getDate()}</button>`;
 }
 $("datePickerGrid").innerHTML=html;
 $("datePickerGrid").querySelectorAll("[data-pick-date]").forEach(button=>button.addEventListener("click",()=>{
  const key=button.dataset.pickDate;
  if(selectedDates.has(key))selectedDates.delete(key);
  else selectedDates.add(key);
  renderDatePicker();
  renderSelectedDateChips();
  updateBulkPreview();
 }));
}

function renderSelectedDateChips(){
 const dates=sortedSelectedDates();
 $("selectedDateChips").innerHTML=dates.length?dates.map(date=>`<button type="button" class="date-chip" data-remove-date="${date}" aria-label="Hapus ${fmtDate(date)}">${fmtDate(date,{day:"2-digit",month:"short"})} <span>×</span></button>`).join(""):'<span class="field-hint">Belum ada tanggal dipilih.</span>';
 $("selectedDateChips").querySelectorAll("[data-remove-date]").forEach(button=>button.addEventListener("click",()=>{
  selectedDates.delete(button.dataset.removeDate);
  renderDatePicker();
  renderSelectedDateChips();
  updateBulkPreview();
 }));
}

function openForm(item=null){
 $("scheduleForm").reset();
 const editing=Boolean(item);
 $("scheduleId").value=item?.id||"";
 $("dialogTitle").textContent=editing?"Edit schedule":"Add schedule";
 $("singleDateField").classList.toggle("hidden",!editing);
 $("multiDateField").classList.toggle("hidden",editing);
 $("singleMemberField").classList.toggle("hidden",!editing);
 $("multiMemberField").classList.toggle("hidden",editing);
 $("singleLocationField").classList.toggle("hidden",!editing);
 $("reimbursementEditFields").classList.toggle("hidden",!editing);
 $("bulkPreview").classList.toggle("hidden",editing);
 $("scheduleDate").value=item?.overtime_date||dateOnly(new Date());
 $("scheduleDate").required=editing;
 $("scheduleMember").value=item?.member||"";
 $("scheduleMember").required=editing;
 $("scheduleLocation").value=item?.work_location||"";
 $("reimbursementStatus").value=item?.reimbursement_status||"not_submitted";
 $("reimbursementSubmittedAt").value=item?.reimbursement_submitted_at||"";
 $("reimbursementReceivedAt").value=item?.reimbursement_received_at||"";
 $("scheduleType").value=item?.overtime_type||"Auto";
 $("scheduleAgenda").value=item?.agenda||"";
 document.querySelectorAll('input[name="scheduleMembers"]').forEach(input=>input.checked=false);
 selectedDates=new Set();
 if(!editing){
  datePickerMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
  renderDatePicker();
  renderSelectedDateChips();
  updateBulkPreview();
 }
 $("formMessage").textContent="";
 dialog.showModal();
}

async function saveForm(e){
 e.preventDefault();
 const id=$("scheduleId").value;
 const agenda=$("scheduleAgenda").value.trim();
 const manualType=$("scheduleType").value;
 if(!agenda){$("formMessage").textContent="Agenda wajib diisi.";return;}
 if(!["Auto","Weekdays","Weekend"].includes(manualType)){
  $("formMessage").textContent="Pilih jenis lembur yang valid.";
  return;
 }

 let records=[];
 if(id){
  const date=$("scheduleDate").value;
  const member=$("scheduleMember").value;
  if(!date||!TEAM.includes(member)||!$("scheduleLocation").value){
   $("formMessage").textContent="Lengkapi tanggal dan anggota.";
   return;
  }
  const selectedType=manualType==="Auto"?typeFromDate(date):manualType;
  const eligible=selectedType==="Weekdays" && $("scheduleLocation").value==="WFH";
  const status=$("reimbursementStatus").value;
  const submitted=$("reimbursementSubmittedAt").value;
  const received=$("reimbursementReceivedAt").value;
  if(eligible && status!=="not_submitted" && !submitted){$("formMessage").textContent="Tanggal pengajuan wajib diisi untuk status Proses atau Done.";return;}
  if(eligible && status==="done" && !received){$("formMessage").textContent="Tanggal dana diterima wajib diisi untuk status Done.";return;}
  records=[{
   overtime_date:date,
   member,
   overtime_type:manualType==="Auto"?typeFromDate(date):manualType,
   work_location:$("scheduleLocation").value,
   agenda,
   reimbursement_status: (manualType==="Auto"?typeFromDate(date):manualType)==="Weekdays" && $("scheduleLocation").value==="WFH" ? $("reimbursementStatus").value : null,
   reimbursement_submitted_at: (manualType==="Auto"?typeFromDate(date):manualType)==="Weekdays" && $("scheduleLocation").value==="WFH" ? ($("reimbursementSubmittedAt").value||null) : null,
   reimbursement_received_at: (manualType==="Auto"?typeFromDate(date):manualType)==="Weekdays" && $("scheduleLocation").value==="WFH" ? ($("reimbursementReceivedAt").value||null) : null,
   updated_at:new Date().toISOString()
  }];
 }else{
  const dates=sortedSelectedDates();
  const members=selectedMembers();
  if(!dates.length||!members.length){
   $("formMessage").textContent="Pilih minimal satu tanggal dan satu anggota.";
   return;
  }
  records=dates.flatMap(date=>members.map(member=>({
   overtime_date:date,
   member,
   overtime_type:manualType==="Auto"?typeFromDate(date):manualType,
   work_location:document.querySelector(`.member-location[data-member="${member}"]`).value,
   reimbursement_status:(manualType==="Auto"?typeFromDate(date):manualType)==="Weekdays" && document.querySelector(`.member-location[data-member="${member}"]`).value==="WFH" ? "not_submitted" : null,
   reimbursement_submitted_at:null,
   reimbursement_received_at:null,
   agenda,
   created_by:currentUser.id,
   updated_at:new Date().toISOString()
  })));
 }

 $("saveSchedule").disabled=true;
 try{
  if(id){
   const {error}=await db.from("overtime_schedules").update(records[0]).eq("id",id);
   if(error)throw error;
   dialog.close();
   toast("Jadwal berhasil diperbarui.");
  }else{
   // Hindari duplikasi untuk kombinasi tanggal + anggota yang sudah ada.
   const dates=[...new Set(records.map(record=>record.overtime_date))];
   const members=[...new Set(records.map(record=>record.member))];
   const {data:existing,error:lookupError}=await db.from("overtime_schedules")
    .select("overtime_date,member")
    .in("overtime_date",dates)
    .in("member",members);
   if(lookupError)throw lookupError;
   const existingKeys=new Set((existing||[]).map(row=>`${row.overtime_date}|${row.member}`));
   const newRecords=records.filter(record=>!existingKeys.has(`${record.overtime_date}|${record.member}`));
   const skipped=records.length-newRecords.length;
   if(!newRecords.length){
    $("formMessage").textContent="Semua kombinasi tanggal dan anggota yang dipilih sudah memiliki jadwal. Tidak ada data baru yang disimpan.";
    return;
   }
   const {error}=await db.from("overtime_schedules").insert(newRecords);
   if(error)throw error;
   dialog.close();
   toast(skipped?`${newRecords.length} jadwal ditambahkan; ${skipped} duplikat dilewati.`:`${newRecords.length} jadwal berhasil ditambahkan.`);
  }
  await loadSchedules();
 }catch(error){
  $("formMessage").textContent=error.message||"Terjadi kesalahan saat menyimpan jadwal.";
 }finally{
  $("saveSchedule").disabled=false;
 }
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
$("reimbursementStatus").addEventListener("change",()=>{
 const status=$("reimbursementStatus").value;
 $("reimbursementSubmittedAt").required=status!=="not_submitted";
 $("reimbursementReceivedAt").required=status==="done";
});
$("datePrevMonth").addEventListener("click",()=>{
 datePickerMonth=new Date(datePickerMonth.getFullYear(),datePickerMonth.getMonth()-1,1);
 renderDatePicker();
});
$("dateNextMonth").addEventListener("click",()=>{
 datePickerMonth=new Date(datePickerMonth.getFullYear(),datePickerMonth.getMonth()+1,1);
 renderDatePicker();
});
$("clearSelectedDates").addEventListener("click",()=>{
 selectedDates.clear();
 renderDatePicker();
 renderSelectedDateChips();
 updateBulkPreview();
});
document.querySelectorAll('input[name="scheduleMembers"]').forEach(input=>input.addEventListener("change",updateBulkPreview));
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
