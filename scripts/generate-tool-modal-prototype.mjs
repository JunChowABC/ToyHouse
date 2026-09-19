import fs from "node:fs";
import path from "node:path";
import art from "../src/art-manifest.js";

const out = "docs/design/核心玩法系统/assets";
const esc = s => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const text = (x, y, s, size = 22, color = "#70565f", anchor = "start", weight = 400) => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}" font-weight="${weight}">${esc(s)}</text>`;
const rect = (x,y,w,h,fill="#fff9ef",stroke="#e8c9cd",r=22) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const asset = (id,x,y,w,h,transform="") => {
  const data = fs.readFileSync(path.join(art.directory,art.assets[id].file)).toString("base64");
  return `<image href="data:image/png;base64,${data}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" ${transform ? `transform="${transform}"` : ""}/>`;
};
const rabbit = (cx,cy,rotation=0,opacity=1) => `<g opacity="${opacity}">${asset("toy_rabbit_white_a",cx-44,cy-74,88,148,`rotate(${rotation} ${cx} ${cy})`)}</g>`;
const coin = (x,y) => asset("ui_resource_coin_icon_01_instance_01",x,y,32,32);
const button = (x,y,buy,disabled=false) => `<g opacity="${disabled ? .42 : 1}">${rect(x,y,260,78,"#edacc0","#fff1e6",30)}${buy ? text(x+69,y+49,"购买",27,"#72474d","middle",700)+coin(x+116,y+26)+text(x+189,y+49,"100",27,"#72474d","middle",700) : text(x+130,y+49,"使用",28,"#72474d","middle",700)}</g>`;
const base = (width,height,title,subtitle,content) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><style>text{font-family:'Microsoft YaHei','Noto Sans CJK SC',sans-serif}</style><rect width="100%" height="100%" fill="#faf6f5"/>${text(54,60,title,34,"#674553","start",700)}${text(54,98,subtitle,20)}${content}</svg>`;

function screen(x,name,icon,stock,used,buy,index) {
  let s = `<g transform="translate(${x} 158) scale(.88)">`;
  s += rect(0,0,540,960,"#efdce0","#d4b4bf",32);
  s += text(270,70,"第01关·月光敲敲窗",25,"#805b61","middle",700);
  s += `<ellipse cx="270" cy="492" rx="247" ry="261" fill="#fcebe7" stroke="#efb6c7" stroke-width="10"/>`;
  for (const [cx,cy,rot] of [[130,230,0],[335,230,90],[140,500,180],[390,535,0],[250,735,-90]]) s+=rabbit(cx,cy,rot,.65);
  for(let i=0;i<3;i++)s+=rect(80+i*132,848,115,80,"#f5cdd9")+text(137+i*132,899,["消除","洗牌","翻转"][i],24,"#805b61","middle");
  s += `<rect width="540" height="960" rx="32" fill="#372a3f" opacity=".64"/>`;
  s += rect(64,253,412,411,"#fff4e8","#edbdc8",29)+rect(79,318,382,329,"#fffaf0","#f1d5cc",23);
  s += rect(70,247,400,90,"#f4bccd","#ffe7df",25);
  s += text(270,304,name,36,"#99644f","middle",700);
  s += `<circle cx="440" cy="270" r="24" fill="#dd92ac" stroke="#fff6ee" stroke-width="2"/>`+text(440,283,"×",36,"white","middle",700);
  if(index===0)s+=rabbit(194,440)+rabbit(350,440);
  if(index===1)s+=rabbit(195,435,-90)+rabbit(353,422,0);
  if(index===2)s+=rabbit(202,399,-90,.36)+rabbit(348,487,90);
  s+=asset(icon,231,424,78,84);
  s+=text(270,566,["指定移除 2 只玩具","随机将 5 只玩具转向","指定 1 只玩具反转方向"][index],24,"#956653","middle",700);
  s+=text(270,604,`已拥有 ${stock} 个`,19,"#a47b80","middle")+text(270,632,`本关已用 ${used} / 3 次`,18,"#a47b80","middle");
  s+=button(140,696,buy);
  s+=`</g>`;
  return s;
}
let c="";
for(const [i,x] of [60,660,1260].entries()) {
  c+=text(x,138,["01  消除 · 无库存，可购买","02  洗牌 · 有库存，可使用","03  翻转 · 有库存，选择目标"][i],24,"#8d5d70","start",700);
  c+=screen(x,["消除","洗牌","翻转"][i],["icon_trash_01_instance_01","icon_shuffle_01_instance_01","icon_flip_01_instance_01"][i],[0,2,1][i],[0,1,2][i],i===0,i);
  c+=text(x,1039,["扣 100 金币，立即进入选 2 只目标","点击使用后立即转向，消耗 1 个道具","点击使用后选 1 只，生效时扣库存"][i],21);
  c+=text(x,1072,["示例余额 ≥100；购买后不再二次确认","不足 5 只按实际可用数量处理","小鸭、空白和无效目标不扣道具"][i],19,"#947c86");
}
c+=text(54,1134,"禁用状态 · 三种道具共用同一套判断",27,"#674553","start",700);
for(const [i,x] of [54,642,1230].entries()){
 c+=rect(x,1160,552,218,"#fffefd","#e5d1d9",20);
 c+=text(x+26,1201,["A  金币不足","B  本关次数用尽","C  没有有效目标"][i],24,"#a1627b","start",700);
 c+=text(x+26,1236,["库存 0，余额 <100","对应道具本关已用 3 / 3 次","没有可作用的待机玩具"][i],20);
 c+=`<g transform="translate(${x+24} 1259) scale(.72)">${button(0,0,i===0,true)}</g>`;
 c+=text(x+230,1305,["金币不足","本关使用次数已达上限","当前没有可使用的目标"][i],18,"#ae667d");
 c+=text(x+26,1353,"仍可关闭；禁用原因固定显示在弹窗内",18,"#947c86");
}
c+=text(54,1424,"统一交互",25,"#674553","start",700);
c+=text(54,1461,"× / Esc：关闭且不扣费　　遮罩：不关闭、不穿透　　弹窗打开：盘面与 Combo 计时冻结",22);
c+=text(54,1499,"状态判断：次数上限 ＞ 无有效目标 ＞ 金币不足。三种道具每关各 3 次；库存与本关次数分开显示。",21);
c+=text(54,1540,"评审说明：余额与库存是展示状态样例，不代表初始赠送；每种初始库存为 0。背景仅示意，不作为关卡布局。",18,"#947c86");
fs.writeFileSync(path.join(out,"道具说明弹窗-交互原型.svg"),base(1800,1580,"道具说明弹窗 · 交互原型 v1.2","2026.09.16  /  三道具完整视图 + 共用状态  /  540×960 逻辑画布等比展示，标题与插图为项目现有资源",c));

let f=`<defs><marker id="arr" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill="none" stroke="#ac8192" stroke-width="1.5"/></marker></defs>`;
const box=(x,y,w,h,title,desc)=>rect(x,y,w,h,"#fffaf2","#d8b6c4",18)+text(x+w/2,y+38,title,24,"#805464","middle",700)+text(x+w/2,y+72,desc,18,"#947c86","middle");
const line=(d)=>`<path d="${d}" fill="none" stroke="#ac8192" stroke-width="2.5" marker-end="url(#arr)"/>`;
f+=box(54,180,280,106,"局内 · 点击道具","满足入口条件，不扣费");
f+=box(434,180,360,106,"道具说明弹窗","冻结盘面、Combo；不穿透");
f+=box(924,180,300,106,"确认购买 / 使用","先检查上限、目标与余额");
f+=box(1324,180,320,106,"使用流程","洗牌直接执行 / 其他选目标");
f+=line("M334 233 H434")+line("M794 233 H924")+line("M1224 233 H1324");
f+=box(434,388,360,106,"关闭 × / Esc","回原盘面，不扣任何费用");
f+=box(924,388,300,106,"不可使用","保持弹窗，显示禁用原因");
f+=box(1324,388,320,106,"有效生效","库存 −1，本关次数 +1");
f+=line("M614 286 V388")+line("M1074 286 V388")+line("M1484 286 V388");
f+=text(629,343,"关闭",18)+text(1089,343,"校验不通过",18)+text(1499,343,"命中有效目标",18);
f+=rect(54,559,1590,182,"#f5e9ee","#e5d1d9",20);
f+=text(80,601,"扣除与取消边界",25,"#805464","start",700);
f+=text(80,641,"购买成功：扣 100 金币并获得 1 个道具，然后立即进入使用流程。有库存时使用不扣金币。",22);
f+=text(80,679,"取消选目标：不扣库存和次数；若已购买，金币不退，未使用道具保留。无效目标不扣库存或次数。",22);
f+=text(80,717,"同关重开、退出重进、刷新：保留已用次数。首次进入新关各 0/3；金币与库存跨关保留。",22);
fs.writeFileSync(path.join(out,"道具说明弹窗-流程图.svg"),base(1700,800,"道具说明弹窗 · 入口、确认与返回 v1.2","与主 MDD 第 4.6 节及 UI 第 11 节配套；禁用不扣费，成功生效才消耗库存与本关次数。",f));
console.log("Generated tool modal prototype and flow SVGs");
