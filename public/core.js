/* ===== core: math parser, answer checking, problem generators (no DOM) ===== */
const R=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const Rnz=(a,b)=>{let v;do v=R(a,b);while(v===0);return v};
const pick=a=>a[Math.floor(Math.random()*a.length)];
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const gcd=(a,b)=>{a=Math.abs(a);b=Math.abs(b);while(b){[a,b]=[b,a%b]}return a};
function frac(n,d=1){if(d<0){n=-n;d=-d}const g=gcd(n,d)||1;n/=g;d/=g;
  return {n,d,v:n/d,tex:d===1?`${n}`:`${n<0?'-':''}\\frac{${Math.abs(n)}}{${d}}`,txt:d===1?`${n}`:`${n}/${d}`}}
function poly(cs,v='x'){const deg=cs.length-1;let s='';cs.forEach((c,i)=>{if(c===0)return;const p=deg-i,ac=Math.abs(c);
  const t=p===0?`${ac}`:`${ac===1?'':ac}${v}${p>1?'^{'+p+'}':''}`;s+=s===''?(c<0?'-':'')+t:(c<0?' - ':' + ')+t});return s||'0'}
function polyTxt(cs,v='x'){const deg=cs.length-1;let s='';cs.forEach((c,i)=>{if(c===0)return;const p=deg-i,ac=Math.abs(c);
  const t=p===0?`${ac}`:`${ac===1?'':ac}${v}${p>1?'^'+p:''}`;s+=s===''?(c<0?'-':'')+t:(c<0?' - ':' + ')+t});return s||'0'}
const sg=n=>n<0?` - ${-n}`:` + ${n}`;               // signed constant term
const sgz=n=>n===0?'':sg(n);
const lin=(a,b,v='x')=>poly([a,b],v);
function polyMul(p,q){const r=Array(p.length+q.length-1).fill(0);p.forEach((a,i)=>q.forEach((b,j)=>r[i+j]+=a*b));return r}
function sqrtSimp(n){let out=1,inn=n;for(let f=2;f*f<=inn;f++){while(inn%(f*f)===0){inn/=f*f;out*=f}}return {out,inn}}
function piTex(n,d){if(n===0)return'0';const f=frac(n,d);const a=Math.abs(f.n),s=f.n<0?'-':'';
  if(f.d===1)return s+(a===1?'':a)+'\\pi';return s+`\\frac{${a===1?'':a}\\pi}{${f.d}}`}
function piTxt(n,d){if(n===0)return'0';const f=frac(n,d);const a=Math.abs(f.n),s=f.n<0?'-':'';return s+(a===1?'':a)+'pi'+(f.d===1?'':'/'+f.d)}
const r2=x=>Math.round(x*100)/100;
const money=x=>'R\\,'+r2(x).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2}).replace(/,/g,'.').replace(/\s/g,'\\,');
// exact-value matcher for trig-type answers
const S2=Math.SQRT2,S3=Math.sqrt(3),S6=Math.sqrt(6);
const EXACT=[[0,'0','0'],[1,'1','1'],[.5,'\\frac{1}{2}','1/2'],[S2/2,'\\frac{\\sqrt{2}}{2}','sqrt(2)/2'],[S3/2,'\\frac{\\sqrt{3}}{2}','sqrt(3)/2'],
 [S3,'\\sqrt{3}','sqrt(3)'],[S3/3,'\\frac{\\sqrt{3}}{3}','sqrt(3)/3'],[2,'2','2'],[2*S3/3,'\\frac{2\\sqrt{3}}{3}','2sqrt(3)/3'],[S2,'\\sqrt{2}','sqrt(2)'],
 [(S6+S2)/4,'\\frac{\\sqrt{6}+\\sqrt{2}}{4}','(sqrt(6)+sqrt(2))/4'],[(S6-S2)/4,'\\frac{\\sqrt{6}-\\sqrt{2}}{4}','(sqrt(6)-sqrt(2))/4'],
 [2+S3,'2+\\sqrt{3}','2+sqrt(3)'],[2-S3,'2-\\sqrt{3}','2-sqrt(3)']];
function exactOf(v){for(const [x,t,s] of EXACT){if(Math.abs(Math.abs(v)-x)<1e-9){if(v<0&&x!==0){const par=/[+-]/.test(s.replace(/^\(/,''));return {tex:'-'+(par&&!t.startsWith('\\frac')?`(${t})`:t),txt:'-'+(par&&!s.startsWith('(')?`(${s})`:s)}}return {tex:t,txt:s}}}return null}

/* ---------- parser ---------- */
const FN=['arcsin','arccos','arctan','asin','acos','atan','sqrt','cbrt','sin','cos','tan','sec','csc','cot','ln','log','abs'];
const NAMES=[...FN,'pi','inf','e','x','y','t','h','i'];
function tokenize(s){s=s.replace(/−/g,'-').replace(/[×·]/g,'*').replace(/÷/g,'/').replace(/π/g,'pi').replace(/√/g,'sqrt').replace(/∞/g,'inf').replace(/²/g,'^2').replace(/³/g,'^3');
  const out=[];let i=0;while(i<s.length){const c=s[i];
    if(/\s/.test(c)){i++;continue}
    if(/[0-9.]/.test(c)){let j=i;while(j<s.length&&/[0-9.]/.test(s[j]))j++;const t=s.slice(i,j);if((t.match(/\./g)||[]).length>1||t==='.')throw Error(`“${t}” isn't a number`);out.push({k:'num',v:parseFloat(t),dec:t.includes('.')});i=j;continue}
    if(/[a-zA-Z]/.test(c)){let j=i;while(j<s.length&&/[a-zA-Z]/.test(s[j]))j++;let w=s.slice(i,j).toLowerCase();
      while(w.length){const n=NAMES.find(n=>w.startsWith(n));if(!n)throw Error(`I don't recognise “${w}”`);out.push({k:FN.includes(n)?'fn':'id',v:n});w=w.slice(n.length)}i=j;continue}
    if('+-*/^()|'.includes(c)){out.push({k:c});i++;continue}
    throw Error(`Unexpected “${c}”`)}
  return out}
function parse(s){const tk=tokenize(s);let p=0;const peek=()=>tk[p],eat=k=>{if(!tk[p]||tk[p].k!==k)throw Error(k===')'?'Missing a closing parenthesis':`Expected “${k}”`);return tk[p++]};
  const starts=t=>t&&(t.k==='num'||t.k==='id'||t.k==='fn'||t.k==='(');
  function expr(){let a=term();while(peek()&&(peek().k==='+'||peek().k==='-')){const op=tk[p++].k;a={t:'bin',op,a,b:term()}}return a}
  function term(){let a=unary();for(;;){const t=peek();if(t&&(t.k==='*'||t.k==='/')){p++;a={t:'bin',op:t.k,a,b:unary()}}else if(starts(t)){a={t:'bin',op:'*',a,b:power(),imp:true}}else break}return a}
  function unary(){const t=peek();if(t&&t.k==='-'){p++;return {t:'neg',a:unary()}}if(t&&t.k==='+'){p++;return unary()}return power()}
  function power(){const a=primary();if(peek()&&peek().k==='^'){p++;return {t:'bin',op:'^',a,b:unary()}}return a}
  function primary(){const t=tk[p++];if(!t)throw Error('The answer ends too early');
    if(t.k==='num')return {t:'num',v:t.v,dec:t.dec};
    if(t.k==='id'){if(t.v==='pi'||t.v==='e'||t.v==='inf')return {t:'const',n:t.v};return {t:'var',n:t.v}}
    if(t.k==='fn'){let arg;if(peek()&&peek().k==='^'&&['sin','cos','tan','sec','csc','cot'].includes(t.v)){p++;const ex=unary();arg=power();return {t:'bin',op:'^',a:{t:'fn',n:t.v,a:arg},b:ex}}
      arg=peek()&&peek().k==='('?primary():power();return {t:'fn',n:t.v,a:arg}}
    if(t.k==='('){const e=expr();eat(')');return {t:'par',a:e}}
    if(t.k==='|'){const e=expr();eat('|');return {t:'fn',n:'abs',a:e}}
    throw Error(`Unexpected “${t.k}”`)}
  if(!tk.length)throw Error('Type an answer first');const r=expr();if(p<tk.length)throw Error(tk[p].k===')'?'There is an extra “)”':`Unexpected “${tk[p].k||tk[p].v}”`);return r}
const F={sqrt:Math.sqrt,cbrt:Math.cbrt,sin:Math.sin,cos:Math.cos,tan:Math.tan,sec:x=>1/Math.cos(x),csc:x=>1/Math.sin(x),cot:x=>1/Math.tan(x),ln:Math.log,log:Math.log10,abs:Math.abs,
  arcsin:Math.asin,arccos:Math.acos,arctan:Math.atan,asin:Math.asin,acos:Math.acos,atan:Math.atan};
function ev(n,env={}){switch(n.t){case'num':return n.v;case'const':return n.n==='pi'?Math.PI:n.n==='e'?Math.E:Infinity;
  case'var':if(n.n in env)return env[n.n];throw Error(`This answer shouldn't contain “${n.n}”`);
  case'par':return ev(n.a,env);case'neg':return -ev(n.a,env);case'fn':return F[n.n](ev(n.a,env));
  case'bin':{const a=ev(n.a,env),b=ev(n.b,env);return n.op==='+'?a+b:n.op==='-'?a-b:n.op==='*'?a*b:n.op==='/'?a/b:Math.pow(a,b)}}}
function toTex(n){const w=x=>x.t==='par'?toTex(x.a):toTex(x);switch(n.t){case'num':return String(n.v);case'const':return n.n==='pi'?'\\pi':n.n==='inf'?'\\infty':'e';case'var':return n.n;
  case'par':return `\\left(${toTex(n.a)}\\right)`;case'neg':return '-'+toTex(n.a);
  case'fn':return n.n==='sqrt'?`\\sqrt{${w(n.a)}}`:n.n==='cbrt'?`\\sqrt[3]{${w(n.a)}}`:n.n==='abs'?`\\left|${w(n.a)}\\right|`:`\\${['sec','csc','cot','sin','cos','tan','ln','log','arcsin','arccos','arctan'].includes(n.n)?n.n:'operatorname{'+n.n+'}'}\\left(${w(n.a)}\\right)`;
  case'bin':if(n.op==='/')return `\\frac{${w(n.a)}}{${w(n.b)}}`;if(n.op==='^'){const b=n.a.t==='bin'||n.a.t==='neg'?`\\left(${toTex(n.a)}\\right)`:toTex(n.a);return `${b}^{${w(n.b)}}`}
    if(n.op==='*'){const r=toTex(n.b);return toTex(n.a)+(n.imp&&!/^[0-9.]/.test(r)?' ':' \\cdot ')+r}return toTex(n.a)+(n.op==='+'?' + ':' - ')+toTex(n.b)}}
const hasDec=n=>!!n&&(n.t==='num'&&n.dec||['a','b'].some(k=>n[k]&&hasDec(n[k])));
function walk(n,f){if(!n)return;f(n);walk(n.a,f);walk(n.b,f)}
const near=(a,b,tol)=>isFinite(a)&&isFinite(b)&&Math.abs(a-b)<=(tol!=null?tol:1e-6*Math.max(1,Math.abs(b)));
const NONE=/^\s*(none|no solutions?|no real solutions?|dne|∅|\{\s*\}|empty|undefined)\s*$/i;

function splitSet(s){return s.split(/,|;|\bor\b|\band\b/i).map(x=>x.trim()).filter(Boolean)}
function parseNum(s,q){const ast=parse(s);const v=ev(ast,{});if(q&&q.exact&&hasDec(ast))throw Error('Give an exact answer: use fractions, sqrt( ) or pi rather than decimals.');return {ast,v}}
/* check(q, input) -> {ok, err?}  err = input problem (not counted as wrong) */
function check(q,inp){try{
  if(q.type==='mc')return {ok:!!q.options[inp]&&q.options[inp].ok};
  if(q.type==='fields'){const res=q.fields.map((f,i)=>{const s=(inp[i]||'').trim();if(!s)throw Error(`Fill in ${f.name||'every box'}`);
      if(f.undef&&NONE.test(s))return true;if(NONE.test(s))return false;const {v}=parseNum(s,{exact:f.tol==null&&q.exact!==false});return near(v,f.ans,f.tol)});
    return {ok:res.every(Boolean),per:res}}
  const s=(inp||'').trim();if(!s)throw Error('Type an answer first');
  if(q.type==='num'){if(NONE.test(s))return {ok:!!q.undef};if(q.undef)return {ok:false};const {ast,v}=parseNum(s,q);
    const reject=resolveReject(q);if(reject){const m=reject(ast,s);if(m)throw Error(m)}return {ok:near(v,q.val,q.tol)}}
  if(q.type==='set'){if(NONE.test(s))return {ok:q.vals.length===0};const vs=splitSet(s).map(x=>parseNum(x,q).v);if(!q.vals.length)return {ok:false};
    const left=q.vals.slice();for(const v of vs){const i=left.findIndex(t=>near(v,t,q.tol));if(i<0){if(q.vals.some(t=>near(v,t,q.tol)))continue;return {ok:false}}left.splice(i,1)}
    return {ok:left.length===0}}
  if(q.type==='expr'){const ast=parse(s);const reject=resolveReject(q);if(reject){const m=reject(ast,s);if(m)throw Error(m)}const exp=parse(q.ans);const v=q.var||'x';const [lo,hi]=q.sample||[-3,3];let n=0;
    for(let i=0;i<24&&n<7;i++){const x=lo+(hi-lo)*((i*0.6180339887)%1)+0.0137*i/7;const env={[v]:x};let e;try{e=ev(exp,env)}catch(_){continue}if(!isFinite(e)||Math.abs(e)>1e7)continue;
      let a;a=ev(ast,env);n++;if(!near(a,e,1e-6*Math.max(1,Math.abs(e))))return {ok:false}}return {ok:n>0}}
 }catch(e){return {ok:false,err:e.message}}}
const noParenReject=(a,s)=>s.includes('(')?'Expand fully: your answer should not contain parentheses.':null;
const factoredReject=a=>{let n=a;while(n.t==='neg')n=n.a;return (n.t==='bin'&&(n.op==='*'||n.op==='^'))?null:'Write it as a product of factors, like (x+2)(x-5).'};
function radReject(a){let m=null;walk(a,n=>{if(n.t==='fn'&&n.n==='sqrt'){try{const v=ev(n.a,{});if(Number.isInteger(v)&&v>1&&sqrtSimp(v).out>1)m='Simplify the radical further: pull perfect-square factors out.'}catch(_){}}
  if(n.t==='bin'&&n.op==='/'){let has=false;walk(n.b,k=>{if(k.t==='fn'&&k.n==='sqrt')has=true});if(has)m='Rationalize: no square roots in the denominator.'}});return m}
const singleFractionReject=(a,s)=>s.includes('/')&&(s.match(/\//g)||[]).length===1?null:'Combine into a single fraction.';
const REJECTS={expand:noParenReject,factored:factoredReject,radical:radReject,singleFraction:singleFractionReject};
function resolveReject(q){return typeof q.reject==='function'?q.reject:REJECTS[q.reject]||null}

/* ---------- interval helpers ---------- */
const iv=(a,b,lc,rc)=>`${lc?'[':'('}${a}, ${b}${rc?']':')'}`;
function insideOutsideMC(lo,hi,inside,closed){const opts=[{tex:iv(lo,hi,true,true),k:'ic'},{tex:iv(lo,hi,false,false),k:'io'},
  {tex:`${iv('-\\infty',lo,false,true)}\\cup${iv(hi,'\\infty',true,false)}`,k:'oc'},{tex:`${iv('-\\infty',lo,false,false)}\\cup${iv(hi,'\\infty',false,false)}`,k:'oo'}];
  const want=(inside?'i':'o')+(closed?'c':'o');return opts.map(o=>({tex:'$'+o.tex+'$',ok:o.k===want}))}
const opTex={'<':'<','<=':'\\le','>':'>','>=':'\\ge'};
const flipOp={'<':'>','<=':'>=','>':'<','>=':'<='};
function rayTex(op,v){return op==='<'?iv('-\\infty',v,false,false):op==='<='?iv('-\\infty',v,false,true):op==='>'?iv(v,'\\infty',false,false):iv(v,'\\infty',true,false)}

/* ---------- skills ---------- */
const P='https://tutorial.math.lamar.edu/Classes/Alg/',PT='https://tutorial.math.lamar.edu/Extras/AlgebraTrigReview/';
const OSC='https://openstax.org/books/college-algebra-2e/pages/',OSP='https://openstax.org/books/precalculus-2e/pages/';
const UNITS=[['A','Foundations'],['B','Equations & inequalities'],['C','Lines, circles & functions'],['D','Graphs & polynomials'],['E','Exponentials & logarithms'],['F','Systems'],['G','Trig functions'],['H','Identities & trig equations']];
const SK=[];const S=o=>SK.push(o);

S({id:'exp-int',unit:'A',name:'Integer exponents',pre:[],paul:P+'IntegerExponents.aspx',os:['College Algebra 1.2',OSC+'1-2-exponents-and-scientific-notation'],
notes:`<p>With the same base, add exponents when you multiply, subtract when you divide, and multiply when you raise a power to a power. A negative exponent means reciprocal.</p>$$a^m a^n=a^{m+n}\\qquad \\frac{a^m}{a^n}=a^{m-n}\\qquad (a^m)^n=a^{mn}\\qquad a^{-n}=\\frac{1}{a^n}$$<p>Watch the sign: $(-3)^2=9$ but $-3^2=-9$. The exponent applies before the minus unless parentheses say otherwise.</p>`,
gen(){const k=R(0,2);
 if(k===0){const a=pick([2,3]);let m,n,p,e;do{m=Rnz(-4,5);n=Rnz(-4,5);p=Rnz(-4,5);e=m+n-p}while(e<-3||e>3);const v=e>=0?frac(a**e):frac(1,a**-e);
  return {type:'num',exact:true,val:v.v,ans:v.txt,ansTex:v.tex,prompt:`Simplify to a single number: $$\\frac{${a}^{${m}}\\cdot ${a}^{${n}}}{${a}^{${p}}}$$`,hint:'Same base, so combine exponents: add on top, then subtract the bottom exponent.',
  steps:[`Top: $${a}^{${m}}\\cdot ${a}^{${n}}=${a}^{${m+n}}$`,`Divide: $${a}^{${m+n}-(${p})}=${a}^{${e}}$`,e<0?`Negative exponent means reciprocal: $${a}^{${e}}=\\frac{1}{${a}^{${-e}}}=${v.tex}$`:`$${a}^{${e}}=${v.tex}$`]}}
 if(k===1){const a=R(2,5),n=R(1,3),inside=Math.random()<.5;const v=inside?frac(n%2?-1:1,a**n):frac(-1,a**n);
  return {type:'num',exact:true,val:v.v,ans:v.txt,ansTex:v.tex,prompt:`Evaluate: $$${inside?`(-${a})^{-${n}}`:`-${a}^{-${n}}`}$$`,hint:'Rewrite the negative exponent as a reciprocal. Is the minus sign inside the parentheses?',
  steps:inside?[`The base is $-${a}$, so $(-${a})^{-${n}}=\\frac{1}{(-${a})^{${n}}}$`,`$(-${a})^{${n}}=${(-a)**n}$, so the value is $${v.tex}$`]:[`The exponent applies only to ${a}: $-${a}^{-${n}}=-\\frac{1}{${a}^{${n}}}$`,`$=${v.tex}$`]}}
 let a,b,c;do{a=R(2,7);b=Rnz(-3,5);c=R(2,3)}while(a===b);const e=c*(a-b);
 return {type:'expr',sample:[.5,2.5],ans:`x^(${e})`,ansTex:`x^{${e}}`,prompt:`Simplify (assume $x>0$): $$\\left(\\frac{x^{${a}}}{x^{${b}}}\\right)^{${c}}$$`,hint:'Simplify inside the parentheses first, then multiply the exponents.',
  steps:[`Inside: $\\frac{x^{${a}}}{x^{${b}}}=x^{${a}-(${b})}=x^{${a-b}}$`,`Power to a power: $\\left(x^{${a-b}}\\right)^{${c}}=x^{${e}}$`]}}});

S({id:'exp-rat',unit:'A',name:'Rational exponents',pre:['exp-int'],paul:P+'RationalExponents.aspx',os:['College Algebra 1.3',OSC+'1-3-radicals-and-rational-exponents'],
notes:`<p>The denominator of a rational exponent is a root; the numerator is a power. Take the root first so the numbers stay small.</p>$$a^{m/n}=\\left(\\sqrt[n]{a}\\right)^m\\qquad a^{-m/n}=\\frac{1}{a^{m/n}}$$<p>Example: $8^{2/3}=(\\sqrt[3]{8})^2=2^2=4$.</p>`,
gen(){let r,k,m;do{r=pick([2,3,4]);k=R(2,r===2?9:r===3?5:3);m=R(1,3)}while(m%r===0||k**m>600||k**r>1000);const neg=Math.random()<.4;const base=k**r;const v=neg?frac(1,k**m):frac(k**m);
 const ex=frac(m,r);return {type:'num',exact:true,val:v.v,ans:v.txt,ansTex:v.tex,prompt:`Evaluate: $$${base}^{${neg?'-':''}${ex.tex}}$$`,hint:`The denominator ${r} means take the ${r===2?'square':r===3?'cube':'4th'} root first.`,
  steps:[`$\\sqrt[${r}]{${base}}=${k}$`,`Raise to the power ${m}: $${k}^{${m}}=${k**m}$`].concat(neg?[`Negative exponent means reciprocal: $${v.tex}$`]:[])}}});

S({id:'radicals',unit:'A',name:'Simplifying & rationalizing radicals',pre:['exp-rat'],paul:P+'Radicals.aspx',os:['College Algebra 1.3',OSC+'1-3-radicals-and-rational-exponents'],
notes:`<p>Pull out the largest perfect-square factor: $\\sqrt{72}=\\sqrt{36\\cdot 2}=6\\sqrt2$. To rationalize, multiply top and bottom by the radical, or by the conjugate when the denominator is a sum or difference.</p>$$\\frac{c}{\\sqrt p+q}\\cdot\\frac{\\sqrt p-q}{\\sqrt p-q}=\\frac{c(\\sqrt p-q)}{p-q^2}$$<p>Enter roots as <code>sqrt(2)</code> or <code>√2</code>.</p>`,
gen(){const k=R(0,2);const sf=[2,3,5,6,7,10,11];
 if(k===0){const s=R(2,7),f=pick(sf),n=s*s*f;return {type:'num',exact:true,val:Math.sqrt(n),ans:`${s}sqrt(${f})`,ansTex:`${s}\\sqrt{${f}}`,reject:radReject,prompt:`Simplify: $$\\sqrt{${n}}$$`,hint:`Look for a perfect square that divides ${n}.`,
  steps:[`$${n}=${s*s}\\cdot ${f}$ and $${s*s}$ is a perfect square`,`$\\sqrt{${n}}=\\sqrt{${s*s}}\\sqrt{${f}}=${s}\\sqrt{${f}}$`]}}
 if(k===1){const f=pick(sf),a=R(2,14);const c=frac(a,f);const tex=`${c.d===1?(c.n===1?'':c.n):''}${c.d===1?'':''}`;
  const ansTex=c.d===1?`${c.n===1?'':c.n}\\sqrt{${f}}`:`\\frac{${c.n===1?'':c.n}\\sqrt{${f}}}{${c.d}}`;const ans=c.d===1?`${c.n}sqrt(${f})`:`${c.n}sqrt(${f})/${c.d}`;
  return {type:'num',exact:true,val:a/Math.sqrt(f),ans,ansTex,reject:radReject,prompt:`Rationalize the denominator: $$\\frac{${a}}{\\sqrt{${f}}}$$`,hint:`Multiply top and bottom by $\\sqrt{${f}}$.`,
  steps:[`$\\frac{${a}}{\\sqrt{${f}}}\\cdot\\frac{\\sqrt{${f}}}{\\sqrt{${f}}}=\\frac{${a}\\sqrt{${f}}}{${f}}$`,`Reduce: $${ansTex}$`]}}
 let p,q,c;do{p=pick([2,3,5,6,7,10,11]);q=R(1,3);c=R(1,8)}while(p===q*q);const den=p-q*q;const g=gcd(c,den);const cn=c/g*(den<0?-1:1),dn=Math.abs(den/g);
 const num=cn===1?`\\sqrt{${p}}-${q}`:cn===-1?`-\\left(\\sqrt{${p}}-${q}\\right)`:`${cn}\\left(\\sqrt{${p}}-${q}\\right)`;const ansTex=dn===1?num:`\\frac{${num}}{${dn}}`;
 return {type:'num',exact:true,val:c/(Math.sqrt(p)+q),ans:`${cn}(sqrt(${p})-${q})/${dn}`,ansTex,reject:radReject,prompt:`Rationalize the denominator: $$\\frac{${c}}{\\sqrt{${p}}+${q}}$$`,hint:`Multiply top and bottom by the conjugate $\\sqrt{${p}}-${q}$.`,
  steps:[`Multiply by $\\frac{\\sqrt{${p}}-${q}}{\\sqrt{${p}}-${q}}$`,`Denominator: $(\\sqrt{${p}})^2-${q}^2=${p}-${q*q}=${den}$`,`Result: $${ansTex}$`]}}});

S({id:'poly-mult',unit:'A',name:'Multiplying polynomials',pre:[],paul:P+'Polynomials.aspx',os:['College Algebra 1.4',OSC+'1-4-polynomials'],
notes:`<p>Multiply every term of the first factor by every term of the second, then combine like terms. For two binomials this is FOIL.</p>$$(a+b)^2=a^2+2ab+b^2\\qquad (a+b)(a-b)=a^2-b^2$$<p>The common mistake: $(x+3)^2\\ne x^2+9$. You lose the middle term $6x$.</p>`,
gen(){const k=R(0,2);let p,q,show;
 if(k===0){p=[R(1,4),Rnz(-7,7)];q=[Rnz(-3,4),Rnz(-7,7)];show=`(${lin(...p)})(${lin(...q)})`}
 else if(k===1){p=[R(1,4),Rnz(-6,6)];q=p;show=`(${lin(...p)})^2`}
 else{p=[1,Rnz(-4,4)];q=[1,Rnz(-4,4),Rnz(-5,5)];show=`(${lin(...p)})(${poly(q)})`}
 const r=polyMul(p,q);return {type:'expr',ans:polyTxt(r).replace(/ /g,''),ansTex:poly(r),reject:noParenReject,prompt:`Expand and simplify: $$${show}$$`,hint:'Distribute each term of the first factor across the second, then collect like terms.',
  steps:[`Distribute: every term times every term`,`Collect like terms: $${poly(r)}$`]}}});

S({id:'factoring',unit:'A',name:'Factoring polynomials',pre:['poly-mult'],paul:P+'Factoring.aspx',os:['College Algebra 1.5',OSC+'1-5-factoring-polynomials'],
notes:`<p>Always pull out the greatest common factor first. For $x^2+bx+c$, find two numbers that multiply to $c$ and add to $b$. For $ax^2+bx+c$, try factor pairs of $a$ and $c$ (or use the ac-method).</p>$$a^2-b^2=(a-b)(a+b)$$<p>Check by expanding your answer.</p>`,
gen(){const k=R(0,3);let fac,cs,steps;
 if(k===0){let r,s;do{r=Rnz(-9,9);s=Rnz(-9,9)}while(r===-s);cs=[1,r+s,r*s];fac=`(x${sg(r)})(x${sg(s)})`;steps=[`Need two numbers with product $${r*s}$ and sum $${r+s}$: ${r} and ${s}`]}
 else if(k===1){let a,b,c,d;do{a=R(2,5);b=Rnz(-7,7);c=1;d=Rnz(-7,7)}while(gcd(a,b)!==1);cs=polyMul([a,b],[c,d]);fac=`(${lin(a,b)})(x${sg(d)})`;steps=[`Leading coefficient ${a} splits as ${a}·1; try pairs for ${cs[2]} until the middle term is $${cs[1]}x$`]}
 else if(k===2){const p=R(1,5),q=R(1,9);cs=[p*p,0,-q*q];fac=`(${lin(p,-q)})(${lin(p,q)})`;steps=[`Difference of squares: $(${p===1?'':p}x)^2-${q}^2$`]}
 else{const g=R(2,4);let r,s;do{r=Rnz(-6,6);s=Rnz(-6,6)}while(r===-s);cs=[g,g*(r+s),g*r*s];fac=`${g}(x${sg(r)})(x${sg(s)})`;steps=[`Factor out the GCF ${g}: $${g}(${poly([1,r+s,r*s])})$`,`Then factor the trinomial`]}
 return {type:'expr',ans:fac.replace(/ /g,''),ansTex:fac,reject:factoredReject,prompt:`Factor completely: $$${poly(cs)}$$`,hint:'GCF first, then look for a pattern or factor pairs.',steps:steps.concat([`$${poly(cs)}=${fac}$`])}}});

S({id:'rational-expr',unit:'A',name:'Rational expressions',pre:['factoring'],paul:P+'RationalExpressions.aspx',os:['College Algebra 1.6',OSC+'1-6-rational-expressions'],
notes:`<p>To simplify, factor the top and bottom and cancel common <em>factors</em> (never terms). To add or subtract, get a common denominator.</p>$$\\frac{a}{x+p}+\\frac{b}{x+q}=\\frac{a(x+q)+b(x+p)}{(x+p)(x+q)}$$`,
gen(){if(Math.random()<.5){let r1,r2,r3;do{r1=Rnz(-6,6);r2=R(-6,6);r3=R(-6,6)}while(r2===r3||r1===r2||r1===r3);const top=polyMul([1,-r1],[1,-r2]),bot=polyMul([1,-r1],[1,-r3]);
  const ans=`(x${sgz(-r2)})/(x${sgz(-r3)})`;return {type:'expr',ans,ansTex:`\\frac{x${sgz(-r2)}}{x${sgz(-r3)}}`,prompt:`Simplify: $$\\frac{${poly(top)}}{${poly(bot)}}$$`,hint:'Factor numerator and denominator, then cancel the shared factor.',
  steps:[`Factor: $\\frac{(x${sgz(-r1)})(x${sgz(-r2)})}{(x${sgz(-r1)})(x${sgz(-r3)})}$`,`Cancel $(x${sgz(-r1)})$: $\\frac{x${sgz(-r2)}}{x${sgz(-r3)}}$`]}}
 let a,b,p,q;do{a=Rnz(-5,5);b=Rnz(-5,5);p=Rnz(-5,5);q=Rnz(-5,5)}while(p===q||a+b===0);const num=[a+b,a*q+b*p];const den=polyMul([1,p],[1,q]);
 const ans=`(${polyTxt(num)})/((x${sg(p)})(x${sg(q)}))`.replace(/ /g,'');
 return {type:'expr',ans,ansTex:`\\frac{${poly(num)}}{(x${sg(p)})(x${sg(q)})}`,reject:singleFractionReject,
  prompt:`Combine into a single fraction: $$\\frac{${a}}{x${sg(p)}}${b<0?'-':'+'}\\frac{${Math.abs(b)}}{x${sg(q)}}$$`,hint:'Common denominator is the product of the two denominators.',
  steps:[`Common denominator $(x${sg(p)})(x${sg(q)})$`,`Numerator: $${a}(x${sg(q)})${b<0?'-':'+'}${Math.abs(b)}(x${sg(p)})=${poly(num)}$`]}}});

S({id:'complex',unit:'A',name:'Complex numbers',pre:['poly-mult'],paul:P+'ComplexNumbers.aspx',os:['Precalculus 3.1',OSP+'3-1-complex-numbers'],
notes:`<p>Treat $i$ like a variable, then replace $i^2$ with $-1$. To divide, multiply top and bottom by the conjugate of the denominator.</p>$$\\frac{a+bi}{c+di}\\cdot\\frac{c-di}{c-di}=\\frac{(a+bi)(c-di)}{c^2+d^2}$$<p>Powers cycle every 4: $i,\\,-1,\\,-i,\\,1$.</p>`,
gen(){const k=R(0,2);const ci=(a,b)=>`${a}${b<0?' - ':' + '}${Math.abs(b)===1?'':Math.abs(b)}i`;
 const out=(re,im,prompt,hint,steps)=>({type:'fields',prompt:prompt+`<p class="sub">Write the answer as $a+bi$.</p>`,fields:[{label:'a',name:'the real part',ans:re.v,ansTex:re.tex},{label:'b',name:'the imaginary part',ans:im.v,ansTex:im.tex}],ansTex:`${re.tex}${im.v<0?'':'+'}${im.tex}i`,hint,steps});
 if(k===0){const a=Rnz(-6,6),b=Rnz(-6,6),c=Rnz(-6,6),d=Rnz(-6,6);const re=a*c-b*d,im=a*d+b*c;
  return out(frac(re),frac(im),`Multiply: $$(${ci(a,b)})(${ci(c,d)})$$`,'FOIL, then use $i^2=-1$.',[`FOIL: $${a*c}${sg(a*d)}i${sg(b*c)}i${sg(b*d)}i^2$`,`$i^2=-1$: $${a*c}${sg(-b*d)}${sg(a*d+b*c)}i$`,`$= ${re}${im<0?'-':'+'}${Math.abs(im)}i$`])}
 if(k===1){const a=Rnz(-6,6),b=Rnz(-6,6),c=Rnz(-4,4),d=Rnz(-4,4);const den=c*c+d*d;const re=frac(a*c+b*d,den),im=frac(b*c-a*d,den);
  return out(re,im,`Divide: $$\\frac{${ci(a,b)}}{${ci(c,d)}}$$`,'Multiply top and bottom by the conjugate of the denominator.',[`Conjugate: $${ci(c,-d)}$`,`Denominator: $${c}^2+${Math.abs(d)}^2=${den}$`,`Numerator: $${a*c+b*d}${sg(b*c-a*d)}i$`,`Result: $${re.tex}${im.v<0?'':'+'}${im.tex}i$`])}
 const n=R(5,60);const cyc=[[1,0],[0,1],[-1,0],[0,-1]][n%4];return out(frac(cyc[0]),frac(cyc[1]),`Simplify: $$i^{${n}}$$`,'Divide the exponent by 4 and use the remainder.',[`$${n}=4\\cdot${Math.floor(n/4)}+${n%4}$`,`$i^{${n}}=i^{${n%4}}=${['1','i','-1','-i'][n%4]}$`])}});

S({id:'linear-eq',unit:'B',name:'Linear equations',pre:[],paul:P+'SolveLinearEqns.aspx',os:['College Algebra 2.2',OSC+'2-2-linear-equations-in-one-variable'],
notes:`<p>Clear fractions by multiplying through by the LCD, distribute, collect the $x$-terms on one side and the constants on the other, then divide.</p><p>If an equation has $x$ in a denominator, check that your answer does not make a denominator zero.</p>`,
gen(){if(Math.random()<.55){let a,b,c,d,e;do{a=Rnz(-6,6);b=Rnz(-7,7);c=R(-9,9);d=Rnz(-6,6);e=R(-12,12)}while(a===d);const x=frac(e+c-a*b,a-d);
  return {type:'num',exact:true,val:x.v,ans:x.txt,ansTex:x.tex,prompt:`Solve for $x$: $$${a}(x${sg(b)})${sgz(-c)}=${lin(d,e)}$$`,hint:'Distribute first, then gather $x$-terms on one side.',
  steps:[`Distribute: $${lin(a,a*b-c)}=${lin(d,e)}$`,`Collect: $${a-d}x=${e+c-a*b}$`,`$x=${x.tex}$`]}}
 let p,r,q;do{p=R(2,6);r=R(2,6);q=Rnz(-5,5)}while(p===r);const x=frac(-q*p*r,r-p);const L=p*r/gcd(p,r);
 return {type:'num',exact:true,val:x.v,ans:x.txt,ansTex:x.tex,prompt:`Solve for $x$: $$\\frac{x}{${p}}${sg(q)}=\\frac{x}{${r}}$$`,hint:`Multiply every term by the LCD, ${L}.`,
  steps:[`Multiply by ${L}: $${L/p}x${sg(q*L)}=${L/r}x$`,`$${L/p-L/r}x=${-q*L}$`,`$x=${x.tex}$`]}}});

const LIT=[
 ['A=P(1+rt)','r',['\\frac{A-P}{Pt}','\\frac{A}{Pt}-1','\\frac{A-P}{t}','\\frac{A-1}{Pt}']],
 ['V=\\frac13\\pi r^2h','h',['\\frac{3V}{\\pi r^2}','\\frac{V}{3\\pi r^2}','3V\\pi r^2','\\frac{\\pi r^2}{3V}']],
 ['ax+by=c','y',['\\frac{c-ax}{b}','\\frac{c}{b}-ax','c-ax-b','\\frac{ax-c}{b}']],
 ['\\frac1a+\\frac1b=\\frac1c','c',['\\frac{ab}{a+b}','a+b','\\frac{a+b}{ab}','ab']],
 ['P=2l+2w','w',['\\frac{P-2l}{2}','P-l','\\frac{P}{2}-2l','\\frac{P-2l}{l}']],
 ['F=\\frac95C+32','C',['\\frac59(F-32)','\\frac59F-32','\\frac95(F-32)','\\frac{F-32}{9}']],
 ['y=\\frac{3x-1}{x+2}','x',['\\frac{2y+1}{3-y}','\\frac{3y-1}{y+2}','\\frac{2y-1}{3-y}','\\frac{y+1}{3}']],
 ['S=2\\pi r^2+2\\pi rh','h',['\\frac{S-2\\pi r^2}{2\\pi r}','S-r','\\frac{S}{2\\pi r}-2\\pi r^2','\\frac{S-2\\pi r}{2\\pi r^2}']]];
S({id:'literal',unit:'B',name:'Solving for a variable',pre:['linear-eq'],paul:P+'SolveMultiVariable.aspx',os:['College Algebra 2.3',OSC+'2-3-models-and-applications'],
notes:`<p>Treat every other letter as a constant and solve exactly as you would a linear equation: undo addition and subtraction first, then multiplication and division.</p><p>If the variable you want appears in two terms, move both to one side and factor it out.</p>`,
gen(){const [eq,v,o]=pick(LIT);return {type:'mc',prompt:`Solve for $${v}$: $$${eq}$$`,options:shuffle(o.map((t,i)=>({tex:`$${v}=${t}$`,ok:i===0}))),ansTex:`${v}=${o[0]}`,hint:`Isolate the terms containing $${v}$ first.`,steps:[`Undo the operations around $${v}$ in reverse order`,`$${v}=${o[0]}$`]}}});

S({id:'quad-factor',unit:'B',name:'Quadratics by factoring',pre:['factoring'],paul:P+'SolveQuadraticEqnsI.aspx',os:['College Algebra 2.5',OSC+'2-5-quadratic-equations'],
notes:`<p>Get zero on one side, factor, then set each factor equal to zero (the zero-product property).</p>$$(ax-p)(x-q)=0\\;\\Rightarrow\\; x=\\tfrac pa\\text{ or }x=q$$<p>Enter both solutions separated by a comma.</p>`,
gen(){let a,p,q;do{a=Math.random()<.6?1:R(2,3);p=Rnz(-8,8);q=Rnz(-8,8)}while(p*1===q*a);const cs=polyMul([a,-p],[1,-q]);const moved=R(-6,6);
 const x1=frac(p,a),x2=frac(q);return {type:'set',exact:true,vals:[x1.v,x2.v],ans:`${x1.txt}, ${x2.txt}`,ansTex:`x=${x1.tex},\\;x=${x2.tex}`,prompt:`Solve: $$${poly([cs[0],cs[1],cs[2]-moved])}=${moved}$$`,hint:'Move everything to one side, then factor.',
  steps:[`$${poly(cs)}=0$`,`Factor: $(${lin(a,-p)})(x${sgz(-q)})=0$`,`$x=${x1.tex}$ or $x=${x2.tex}$`]}}});

S({id:'complete-square',unit:'B',name:'Completing the square',pre:['quad-factor'],paul:P+'SolveQuadraticEqnsII.aspx',os:['Precalculus 3.2',OSP+'3-2-quadratic-functions'],
notes:`<p>For $x^2+bx$, add and subtract $\\left(\\tfrac b2\\right)^2$. If the leading coefficient isn't 1, factor it out of the $x$ terms first.</p>$$ax^2+bx+c=a(x-h)^2+k,\\qquad h=-\\frac{b}{2a},\\; k=c-ah^2$$`,
gen(){const a=pick([1,1,1,2,-1,3]),h=Rnz(-6,6),k=R(-9,9);const cs=[a,-2*a*h,a*h*h+k];
 return {type:'fields',prompt:`Write $f(x)=${poly(cs)}$ in the form $a(x-h)^2+k$ (here $a=${a}$).`,fields:[{label:'h',name:'h',ans:h},{label:'k',name:'k',ans:k}],ansTex:`${a===1?'':a===-1?'-':a}(x${sg(-h)})^2${sgz(k)}`,hint:'$h=-\\frac{b}{2a}$. Then find $k$ by plugging $x=h$ into $f$.',
  steps:[a!==1?`Factor ${a} from the $x$-terms: $${a}(${poly([1,-2*h])})${sgz(cs[2])}$`:`Half of $${-2*h}$ is $${-h}$; square it: $${h*h}$`,`Add and subtract $${h*h}$ inside: $${a===1?'':a===-1?'-':a}(x${sg(-h)})^2${sgz(k)}$`,`So $h=${h}$, $k=${k}$`]}}});

S({id:'quad-formula',unit:'B',name:'The quadratic formula',pre:['radicals','quad-factor'],paul:P+'SolveQuadraticEqnsII.aspx',os:['College Algebra 2.5',OSC+'2-5-quadratic-equations'],
notes:`$$x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$$<p>Simplify the radical and reduce the fraction only if every term shares a factor. Enter both answers, e.g. <code>(-3+sqrt(5))/2, (-3-sqrt(5))/2</code>.</p>`,
gen(){let a,b,c,D;do{a=R(1,3);b=R(-7,7);c=Rnz(-6,6);D=b*b-4*a*c}while(D<=0||Number.isInteger(Math.sqrt(D)));const {out:s,inn:f}=sqrtSimp(D);const g=gcd(gcd(b,s),2*a)||1;
 const N=-b/g,Sq=s/g,Dn=2*a/g;const rad=`${Sq===1?'':Sq}\\sqrt{${f}}`;const numT=N===0?`\\pm${rad}`:`${N}\\pm${rad}`;const tex=Dn===1?numT:`\\frac{${numT}}{${Dn}}`;
 const r1=(-b+Math.sqrt(D))/(2*a),r2=(-b-Math.sqrt(D))/(2*a);
 return {type:'set',exact:true,vals:[r1,r2],ans:`(${-b}+sqrt(${D}))/${2*a}, (${-b}-sqrt(${D}))/${2*a}`,ansTex:`x=${tex}`,prompt:`Solve using the quadratic formula: $$${poly([a,b,c])}=0$$`,hint:`$a=${a}$, $b=${b}$, $c=${c}$. Start with the discriminant $b^2-4ac$.`,
  steps:[`$b^2-4ac=${b*b}-(${4*a*c})=${D}$`,`$\\sqrt{${D}}=${s===1?'':s}\\sqrt{${f}}$`,`$x=\\frac{${-b}\\pm${s===1?'':s}\\sqrt{${f}}}{${2*a}}=${tex}$`]}}});

S({id:'discriminant',unit:'B',name:'The discriminant',pre:['quad-formula'],paul:P+'SolveQuadraticEqnSummary.aspx',os:['College Algebra 2.5',OSC+'2-5-quadratic-equations'],
notes:`<p>The discriminant $D=b^2-4ac$ tells you what kind of solutions to expect without solving.</p><ul><li>$D>0$: two distinct real solutions</li><li>$D=0$: one repeated real solution</li><li>$D<0$: two complex (non-real) solutions</li></ul>`,
gen(){const t=R(0,2);let a,b,c,D;do{a=Rnz(-4,4);b=R(-8,8);c=R(-8,8);D=b*b-4*a*c}while((t===0&&D<=0)||(t===1&&D!==0)||(t===2&&D>=0));
 if(t===1){const r=Rnz(-5,5),k=pick([1,2,-1,4]);a=k;b=-2*k*r;c=k*r*r;D=0}
 const o=[['Two distinct real solutions',D>0],['One repeated real solution',D===0],['Two complex (non-real) solutions',D<0]];
 return {type:'mc',prompt:`How many and what kind of solutions does this equation have? $$${poly([a,b,c])}=0$$`,options:o.map(([tex,ok])=>({tex,ok})),ansTex:`D=${D}`,hint:'Compute $b^2-4ac$ and look at its sign.',
  steps:[`$D=(${b})^2-4(${a})(${c})=${D}$`,D>0?'Positive, so two distinct real solutions':D===0?'Zero, so one repeated real solution':'Negative, so two complex solutions']}}});

S({id:'radical-eq',unit:'B',name:'Equations with radicals',pre:['quad-factor'],paul:P+'SolveRadicalEqns.aspx',os:['College Algebra 2.6',OSC+'2-6-other-types-of-equations'],
notes:`<p>Isolate the radical, square both sides, solve the resulting equation, then <strong>check every answer in the original</strong>. Squaring can introduce extraneous solutions.</p><p>If no candidate checks out, type <code>none</code>.</p>`,
gen(){let b,s,a,s2;do{b=R(-2,3);s=R(0,7);a=(s+b)**2-s;s2=1-2*b-s}while(s+b<0||s===s2||a<-20||a>40);const valid=[s];const ok2=s2+b>=0;if(ok2)valid.push(s2);
 const eqL=a===0?'\\sqrt{x}':`\\sqrt{x${sg(a)}}`;const eqR=b===0?'x':`x${sg(b)}`;
 return {type:'set',exact:true,vals:valid,ans:valid.join(', '),ansTex:`x=${valid.join(',\\;x=')}`,prompt:`Solve: $$${eqL}=${eqR}$$`,hint:'Square both sides, solve the quadratic, then check both candidates in the original equation.',
  steps:[`Square: $x${sgz(a)}=(${eqR})^2=${poly([1,2*b,b*b])}$`,`Rearrange: $${poly([1,2*b-1,b*b-a])}=0$`,`Candidates: $x=${s}$ and $x=${s2}$`,`Check $x=${s2}$: right side is $${s2+b}$ ${ok2?'which is ≥ 0, so it works':'which is negative, but a square root is never negative: extraneous'}`]}}});

S({id:'abs-eq',unit:'B',name:'Absolute value equations',pre:['linear-eq'],paul:P+'SolveAbsValueEqns.aspx',os:['College Algebra 2.6',OSC+'2-6-other-types-of-equations'],
notes:`<p>Isolate the absolute value first. Then $|u|=c$ with $c>0$ splits into $u=c$ or $u=-c$. If $c<0$ there is no solution (type <code>none</code>).</p>`,
gen(){const a=pick([1,2,3,-2,4]),b=Rnz(-9,9);const k=Math.random()<.4?R(1,6):0;const none=Math.random()<.2;const c=none?-R(1,5):R(1,9);const m=c+k;
 const L=`|${lin(a,b)}|${k?sg(k):''}`;if(none)return {type:'set',vals:[],ans:'none',ansTex:'\\text{no solution}',prompt:`Solve: $$${L}=${m}$$`,hint:'Isolate the absolute value. Can it equal a negative number?',steps:[`Isolate: $|${lin(a,b)}|=${c}$`,'An absolute value is never negative, so there is no solution']};
 const x1=frac(c-b,a),x2=frac(-c-b,a);return {type:'set',exact:true,vals:[x1.v,x2.v],ans:`${x1.txt}, ${x2.txt}`,ansTex:`x=${x1.tex},\\;x=${x2.tex}`,prompt:`Solve: $$${L}=${m}$$`,hint:'Isolate the absolute value, then split into two equations.',
  steps:(k?[`Isolate: $|${lin(a,b)}|=${c}$`]:[]).concat([`$${lin(a,b)}=${c}$ or $${lin(a,b)}=${-c}$`,`$x=${x1.tex}$ or $x=${x2.tex}$`])}}});

S({id:'linear-ineq',unit:'B',name:'Linear inequalities',pre:['linear-eq'],paul:P+'SolveLinearInequalities.aspx',os:['College Algebra 2.7',OSC+'2-7-linear-inequalities-and-absolute-value-inequalities'],
notes:`<p>Solve like an equation, with one rule: <strong>multiplying or dividing by a negative flips the inequality</strong>. Write answers in interval notation: parentheses for strict, brackets for “or equal”, always parentheses at $\\pm\\infty$.</p>`,
gen(){let a,b,c,d,A,D;do{a=Rnz(-6,6);b=R(-9,9);c=R(-6,6);d=R(-9,9);A=a-c;D=d-b}while(A===0||D===0);const op=pick(['<','<=','>','>=']);const v=frac(D,A);const fop=A<0?flipOp[op]:op;const w=frac(-D,A);
 const opts=[[rayTex(fop,v.tex),true],[rayTex(flipOp[fop],v.tex),false],[rayTex(fop,w.tex),false],[rayTex(flipOp[fop],w.tex),false]];
 return {type:'mc',prompt:`Solve and give the answer in interval notation: $$${lin(a,b)}${opTex[op]}${lin(c,d)}$$`,options:shuffle(opts.map(([t,ok])=>({tex:`$${t}$`,ok}))),ansTex:rayTex(fop,v.tex),hint:'Collect $x$ on one side. Are you dividing by a negative?',
  steps:[`Collect: $${A}x${opTex[op]}${D}$`,A<0?`Divide by $${A}$ and flip: $x${opTex[fop]}${v.tex}$`:`Divide by ${A}: $x${opTex[fop]}${v.tex}$`,`Interval: $${rayTex(fop,v.tex)}$`]}}});

S({id:'poly-ineq',unit:'B',name:'Polynomial inequalities',pre:['linear-ineq','quad-factor'],paul:P+'SolvePolyInequalities.aspx',os:['Precalculus 3.4',OSP+'3-4-graphs-of-polynomial-functions'],
notes:`<p>Move everything to one side, find the zeros, and mark them on a number line. Test one point in each region to see where the expression is positive or negative.</p><p>For an upward parabola, $(x-r_1)(x-r_2)<0$ between the roots and $>0$ outside them.</p>`,
gen(){let r1,r2;do{r1=R(-7,6);r2=R(-6,7)}while(r2<=r1);const a=pick([1,1,-1]);const op=pick(['<','<=','>','>=']);const cs=polyMul([a,-a*r1],[1,-r2]);
 const neg=op[0]==='<';const inside=a>0?neg:!neg;const closed=op.length===2;
 return {type:'mc',prompt:`Solve: $$${poly(cs)}${opTex[op]}0$$`,options:insideOutsideMC(r1,r2,inside,closed),ansTex:inside?iv(r1,r2,closed,closed):'\\text{outside}',hint:'Factor, find the zeros, then test a point between them.',
  steps:[`Factor: $${a<0?'-':''}(x${sgz(-r1)})(x${sgz(-r2)})${opTex[op]}0$`,`Zeros at $x=${r1}$ and $x=${r2}$`,`Test $x=${(r1+r2)/2}$: value is ${a>0?'negative':'positive'}, so the expression is ${a>0?'negative':'positive'} between the zeros`,`Answer is the ${inside?'inside':'outside'} region, ${closed?'including':'excluding'} the endpoints`]}}});

S({id:'abs-ineq',unit:'B',name:'Absolute value inequalities',pre:['abs-eq','linear-ineq'],paul:P+'SolveAbsValueIneq.aspx',os:['College Algebra 2.7',OSC+'2-7-linear-inequalities-and-absolute-value-inequalities'],
notes:`$$|u|<c\\iff -c<u<c\\qquad\\qquad |u|>c\\iff u<-c\\text{ or }u>c$$<p>“Less than” gives one interval between two values; “greater than” gives two rays pointing outward.</p>`,
gen(){const a=pick([1,2,3,4]),b=Rnz(-8,8),c=R(1,9);const op=pick(['<','<=','>','>=']);const lo=frac(-c-b,a),hi=frac(c-b,a);const inside=op[0]==='<',closed=op.length===2;
 return {type:'mc',prompt:`Solve: $$|${lin(a,b)}|${opTex[op]}${c}$$`,options:insideOutsideMC(lo.tex,hi.tex,inside,closed),ansTex:inside?iv(lo.tex,hi.tex,closed,closed):'\\text{outside}',hint:inside?'Rewrite as a double inequality.':'Split into two separate inequalities.',
  steps:[inside?`$-${c}${opTex[op]}${lin(a,b)}${opTex[op]}${c}$`:`$${lin(a,b)}${opTex[flipOp[op]]}-${c}$ or $${lin(a,b)}${opTex[op]}${c}$`,`Solve each part: boundaries $${lo.tex}$ and $${hi.tex}$`]}}});

S({id:'lines',unit:'C',name:'Slope & equations of lines',pre:['linear-eq'],paul:P+'Lines.aspx',os:['Precalculus 2.1',OSP+'2-1-linear-functions'],
notes:`$$m=\\frac{y_2-y_1}{x_2-x_1}\\qquad y-y_1=m(x-x_1)\\qquad y=mx+b$$<p>Parallel lines share a slope. Perpendicular slopes are negative reciprocals: $m_\\perp=-\\frac1m$.</p>`,
gen(){const k=R(0,1);if(k===0){let x1,y1,x2,y2;do{x1=R(-6,6);y1=R(-6,6);x2=R(-6,6);y2=R(-6,6)}while(x1===x2||y1===y2);const m=frac(y2-y1,x2-x1);const b=frac(y1*m.d-m.n*x1,m.d);
  return {type:'fields',prompt:`Find the line through $(${x1},${y1})$ and $(${x2},${y2})$ in the form $y=mx+b$.`,fields:[{label:'m',name:'m',ans:m.v,ansTex:m.tex},{label:'b',name:'b',ans:b.v,ansTex:b.tex}],ansTex:`y=${m.tex}x${b.v<0?'':'+'}${b.tex}`,hint:'Slope first, then plug one point into $y=mx+b$ to find $b$.',
  steps:[`$m=\\frac{${y2}-(${y1})}{${x2}-(${x1})}=${m.tex}$`,`$${y1}=${m.tex}(${x1})+b$`,`$b=${b.tex}$`]}}
 const m=frac(Rnz(-5,5),R(1,4)),c=R(-5,5),px=R(-6,6),py=R(-6,6);const mp=frac(-m.d,m.n);const b=frac(py*mp.d-mp.n*px,mp.d);
 return {type:'fields',prompt:`Find the line perpendicular to $y=${m.tex}x${sgz(c)}$ that passes through $(${px},${py})$. Give it as $y=mx+b$.`,fields:[{label:'m',name:'m',ans:mp.v,ansTex:mp.tex},{label:'b',name:'b',ans:b.v,ansTex:b.tex}],ansTex:`y=${mp.tex}x${b.v<0?'':'+'}${b.tex}`,hint:'Negative reciprocal slope, then use the point.',
  steps:[`$m_\\perp=-\\frac{1}{${m.tex}}=${mp.tex}$`,`$${py}=${mp.tex}(${px})+b\\Rightarrow b=${b.tex}$`]}}});

S({id:'circles',unit:'C',name:'Circles',pre:['complete-square'],paul:P+'Circles.aspx',os:['College Algebra 2.1',OSC+'2-1-the-rectangular-coordinate-systems-and-graphs'],
notes:`$$(x-h)^2+(y-k)^2=r^2$$<p>Center $(h,k)$, radius $r$. From the expanded form, complete the square separately in $x$ and in $y$.</p>`,
gen(){const h=Rnz(-6,6),k=Rnz(-6,6),r=R(1,7);const F=h*h+k*k-r*r;
 return {type:'fields',prompt:`Find the center and radius: $$x^2+y^2${sg(-2*h)}x${sg(-2*k)}y${sgz(F)}=0$$`,fields:[{label:'h',name:'h',ans:h},{label:'k',name:'k',ans:k},{label:'r',name:'r',ans:r}],ansTex:`(${h},${k}),\\;r=${r}`,hint:'Group $x$-terms and $y$-terms and complete the square in each.',
  steps:[`$(x^2${sg(-2*h)}x+${h*h})+(y^2${sg(-2*k)}y+${k*k})=${-F}+${h*h}+${k*k}$`,`$(x${sg(-h)})^2+(y${sg(-k)})^2=${r*r}$`,`Center $(${h},${k})$, radius $${r}$`]}}});

S({id:'func-eval',unit:'C',name:'Function notation',pre:['poly-mult'],paul:P+'FunctionDefn.aspx',os:['Precalculus 1.1',OSP+'1-1-functions-and-function-notation'],
notes:`<p>$f(\\text{something})$ means: replace every $x$ in the formula with that something, in parentheses.</p><p>$f(x+h)$ is <em>not</em> $f(x)+h$. Substitute the whole expression $x+h$.</p>`,
gen(){const k=R(0,2);if(k===0){const a=Rnz(-4,4),b=R(-6,6),c=R(-9,9),t=Rnz(-4,4);const v=a*t*t+b*t+c;
  return {type:'num',val:v,ans:String(v),ansTex:String(v),prompt:`If $f(x)=${poly([a,b,c])}$, find $f(${t})$.`,hint:'Put the input in parentheses before squaring.',steps:[`$f(${t})=${a}(${t})^2${sg(b)}(${t})${sgz(c)}$`,`$=${a*t*t}${sg(b*t)}${sgz(c)}=${v}$`]}}
 if(k===1){let a,b,t;do{a=Rnz(-6,6);b=Rnz(-6,6);t=R(-5,5)}while(t===b);const v=frac(t+a,t-b);
  return {type:'num',exact:true,val:v.v,ans:v.txt,ansTex:v.tex,prompt:`If $g(x)=\\dfrac{x${sg(a)}}{x${sg(-b)}}$, find $g(${t})$.`,hint:'Substitute and simplify the fraction.',steps:[`$g(${t})=\\frac{${t}${sg(a)}}{${t}${sg(-b)}}=\\frac{${t+a}}{${t-b}}=${v.tex}$`]}}
 const b=Rnz(-5,5),c=R(-6,6),h=Rnz(-3,3);const r=[1,2*h+b,h*h+b*h+c];
 return {type:'expr',ans:polyTxt(r).replace(/ /g,''),ansTex:poly(r),prompt:`If $f(x)=${poly([1,b,c])}$, find and simplify $f(x${sg(h)})$.`,hint:`Replace every $x$ with $(x${sg(h)})$.`,
  steps:[`$f(x${sg(h)})=(x${sg(h)})^2${sg(b)}(x${sg(h)})${sgz(c)}$`,`$=${poly([1,2*h,h*h])}${sg(b)}x${sg(b*h)}${sgz(c)}$`,`$=${poly(r)}$`]}}});

S({id:'domain',unit:'C',name:'Domain of a function',pre:['func-eval','linear-ineq'],paul:P+'FunctionDefn.aspx',os:['Precalculus 1.2',OSP+'1-2-domain-and-range'],
notes:`<p>Two things to rule out in real-valued algebra:</p><ul><li>Division by zero: exclude values that make a denominator $0$.</li><li>Even roots of negatives: require what's under $\\sqrt{\\ }$ to be $\\ge 0$.</li></ul>`,
gen(){const k=R(0,2);let prompt,opts,steps;
 if(k===0){const a=R(1,4),b=Rnz(-9,9);const v=frac(b,a),w=frac(-b,a);prompt=`$$f(x)=\\sqrt{${lin(a,-b)}}$$`;
  opts=[[iv(v.tex,'\\infty',true,false),1],[iv(v.tex,'\\infty',false,false),0],[iv('-\\infty',v.tex,false,true),0],[iv(w.tex,'\\infty',true,false),0]];steps=[`Need $${lin(a,-b)}\\ge0$`,`$x\\ge${v.tex}$`]}
 else if(k===1){const K=R(1,6),c=Rnz(-7,7);prompt=`$$f(x)=\\frac{x${sg(c)}}{x^2-${K*K}}$$`;
  opts=[[`${iv('-\\infty',-K)}\\cup${iv(-K,K)}\\cup${iv(K,'\\infty')}`,1],[`${iv('-\\infty',K)}\\cup${iv(K,'\\infty')}`,0],[`${iv('-\\infty',-c)}\\cup${iv(-c,'\\infty')}`,0],[`${iv('-\\infty','\\infty')}`,0]];steps=[`Denominator zero when $x^2=${K*K}$, so $x=\\pm${K}$`,'Exclude both']}
 else{const p=R(-6,4),q=p+R(1,5);prompt=`$$f(x)=\\frac{\\sqrt{x${sgz(-p)}}}{x${sgz(-q)}}$$`;
  opts=[[`${iv(p,q,true,false)}\\cup${iv(q,'\\infty')}`,1],[iv(p,'\\infty',true,false),0],[`${iv(p,q)}\\cup${iv(q,'\\infty')}`,0],[`${iv('-\\infty',q)}\\cup${iv(q,'\\infty')}`,0]];steps=[`Root needs $x\\ge${p}$`,`Denominator needs $x\\ne${q}$`]}
 return {type:'mc',prompt:`Find the domain: ${prompt}`,options:shuffle(opts.map(([t,ok])=>({tex:`$${t}$`,ok:!!ok}))),ansTex:opts[0][0],hint:'Look for denominators and square roots.',steps}}});

S({id:'composition',unit:'C',name:'Composition of functions',pre:['func-eval'],paul:P+'CombineFunctions.aspx',os:['Precalculus 1.4',OSP+'1-4-composition-of-functions'],
notes:`$$(f\\circ g)(x)=f\\big(g(x)\\big)$$<p>Work from the inside out: evaluate $g$ first, then feed the result into $f$. In general $f\\circ g\\ne g\\circ f$.</p>`,
gen(){const a=Rnz(-4,4),b=R(-6,6),c=R(-5,5);const f=lin(a,b),g=poly([1,0,c]);
 if(Math.random()<.5){const t=Rnz(-4,4);const gv=t*t+c,v=a*gv+b;return {type:'num',val:v,ans:String(v),ansTex:String(v),prompt:`Let $f(x)=${f}$ and $g(x)=${g}$. Find $(f\\circ g)(${t})$.`,hint:`Find $g(${t})$ first.`,steps:[`$g(${t})=${gv}$`,`$f(${gv})=${a}(${gv})${sgz(b)}=${v}$`]}}
 const r=polyMul([a,b],[a,b]);r[2]+=c;return {type:'expr',ans:polyTxt(r).replace(/ /g,''),ansTex:poly(r),prompt:`Let $f(x)=${f}$ and $g(x)=${g}$. Find and simplify $(g\\circ f)(x)$.`,hint:'Substitute the whole of $f(x)$ into $g$.',steps:[`$g(f(x))=(${f})^2${sgz(c)}$`,`$=${poly(r)}$`]}}});

S({id:'inverse',unit:'C',name:'Inverse functions',pre:['composition','literal'],paul:P+'InverseFunctions.aspx',os:['Precalculus 1.7',OSP+'1-7-inverse-functions'],
notes:`<p>To find $f^{-1}$: write $y=f(x)$, swap $x$ and $y$, then solve for $y$.</p><p>Check: $f\\big(f^{-1}(x)\\big)=x$. Enter cube roots as <code>cbrt(x)</code>.</p>`,
gen(){const k=R(0,2);if(k===0){const a=Rnz(-5,5),b=Rnz(-8,8);return {type:'expr',ans:`(x-(${b}))/(${a})`,ansTex:`\\frac{x${sg(-b)}}{${a}}`,prompt:`Find $f^{-1}(x)$ for $f(x)=${lin(a,b)}$.`,hint:'Swap $x$ and $y$, then solve for $y$.',steps:[`$x=${lin(a,b,'y')}$`,`$y=\\frac{x${sg(-b)}}{${a}}$`]}}
 if(k===1){const K=Rnz(-8,8);return {type:'expr',sample:[K+.3,K+9],ans:`cbrt(x-(${K}))`,ansTex:`\\sqrt[3]{x${sg(-K)}}`,prompt:`Find $f^{-1}(x)$ for $f(x)=x^3${sg(K)}$.`,hint:'Swap, isolate $y^3$, then take a cube root.',steps:[`$x=y^3${sg(K)}$`,`$y^3=x${sg(-K)}$`,`$y=\\sqrt[3]{x${sg(-K)}}$`]}}
 let a,b,d;do{a=Rnz(-4,4);b=Rnz(-6,6);d=Rnz(-5,5)}while(a*d===b);return {type:'expr',ans:`((${b})-(${d})*x)/(x-(${a}))`,ansTex:`\\frac{${-d===1?'':-d===-1?'-':-d}x${sg(b)}}{x${sg(-a)}}`.replace(/^\\frac\{(-?\d*)x/,(m,c)=>m),prompt:`Find $f^{-1}(x)$ for $f(x)=\\dfrac{${lin(a,b)}}{x${sg(d)}}$.`,hint:'Swap, multiply by the denominator, gather the $y$-terms and factor out $y$.',
  steps:[`$x=\\frac{${lin(a,b,'y')}}{y${sg(d)}}$`,`$xy${sg(d)}x=${lin(a,b,'y')}$`,`$y(x${sg(-a)})=${-d}x${sg(b)}$`,`$y=\\frac{${-d}x${sg(b)}}{x${sg(-a)}}$`]}}});

S({id:'vertex',unit:'D',name:'Parabolas & the vertex',pre:['complete-square'],paul:P+'Parabolas.aspx',os:['Precalculus 3.2',OSP+'3-2-quadratic-functions'],
notes:`$$f(x)=ax^2+bx+c:\\quad x_v=-\\frac{b}{2a},\\quad y_v=f(x_v)$$<p>If $a>0$ the parabola opens up and the vertex is a minimum; if $a<0$ it opens down and the vertex is a maximum.</p>`,
gen(){const a=pick([1,-1,2,-2,3]),h=R(-5,5),k=R(-9,9);const cs=[a,-2*a*h,a*h*h+k];const mm=a>0?'minimum':'maximum';
 return {type:'fields',prompt:`Find the vertex $(h,k)$ of $f(x)=${poly(cs)}$.`,fields:[{label:'h',name:'h',ans:h},{label:'k',name:'k',ans:k}],ansTex:`(${h},${k})`,hint:'$h=-\\frac{b}{2a}$, then $k=f(h)$.',
  steps:[`$h=-\\frac{${cs[1]}}{2(${a})}=${h}$`,`$k=f(${h})=${k}$`,`Since $a${a>0?'>':'<'}0$, the vertex is a ${mm}`]}}});

S({id:'transform',unit:'D',name:'Transformations of graphs',pre:['func-eval'],paul:P+'Transformations.aspx',os:['Precalculus 1.5',OSP+'1-5-transformation-of-functions'],
notes:`$$g(x)=a\\,f(x-h)+k$$<p>$h$ shifts right (left if negative), $k$ shifts up (down if negative), $a<0$ reflects across the $x$-axis, and $|a|>1$ stretches vertically. The horizontal shift runs opposite to the sign you see: $f(x-3)$ moves right.</p>`,
gen(){const bases=[['x^2',u=>`(${u})^2`],['\\sqrt{x}',u=>`\\sqrt{${u}}`],['|x|',u=>`|${u}|`],['x^3',u=>`(${u})^3`]];const [bn,bf]=pick(bases);const h=Rnz(-5,5),k=Rnz(-6,6),a=pick([1,-1,2,-1]);
 const g=`${a===1?'':a===-1?'-':a}${bf(`x${sg(-h)}`)}${sg(k)}`;const d=(H,K,A)=>[H>0?`right ${H}`:`left ${-H}`,A<0?'reflect across the $x$-axis':null,Math.abs(A)===2?'stretch vertically by 2':null,K>0?`up ${K}`:`down ${-K}`].filter(Boolean).join(', ');
 const opts=[[d(h,k,a),1],[d(-h,k,a),0],[d(h,-k,a),0],[d(-h,-k,a),0]];
 return {type:'mc',prompt:`How is $g(x)=${g}$ obtained from $f(x)=${bn}$?`,options:shuffle(opts.map(([t,ok])=>({tex:t[0].toUpperCase()+t.slice(1),ok:!!ok}))),ansTex:'\\text{'+d(h,k,a).replace(/\$/g,'')+'}',hint:'Inside the function affects $x$ (opposite direction). Outside affects $y$.',
  steps:[`Inside: $x${sg(-h)}$ means shift ${h>0?'right':'left'} ${Math.abs(h)}`,`Outside: $${sg(k)}$ means shift ${k>0?'up':'down'} ${Math.abs(k)}`].concat(a!==1?[a<0?'Negative in front: reflect across the $x$-axis':'Factor 2 in front: vertical stretch']:[])}}});

S({id:'asymptotes',unit:'D',name:'Rational function asymptotes',pre:['rational-expr','domain'],paul:P+'GraphRationalFcns.aspx',os:['Precalculus 3.7',OSP+'3-7-rational-functions'],
notes:`<p>Vertical asymptotes sit where the (reduced) denominator is zero. For the horizontal asymptote compare degrees: equal degrees give $y=\\frac{\\text{leading coeff. top}}{\\text{leading coeff. bottom}}$; bigger bottom gives $y=0$.</p>`,
gen(){if(Math.random()<.6){let a,b,c,d;do{a=Rnz(-6,6);b=R(-8,8);c=Rnz(-4,4);d=Rnz(-8,8)}while(a*d===b*c);const va=frac(-d,c),ha=frac(a,c);
  return {type:'fields',prompt:`Find the vertical and horizontal asymptotes of $$f(x)=\\frac{${lin(a,b)}}{${lin(c,d)}}$$`,fields:[{label:'\\text{VA: }x',name:'the vertical asymptote',ans:va.v,ansTex:va.tex},{label:'\\text{HA: }y',name:'the horizontal asymptote',ans:ha.v,ansTex:ha.tex}],ansTex:`x=${va.tex},\\;y=${ha.tex}`,hint:'Set the denominator to zero. Degrees are equal, so divide the leading coefficients.',
  steps:[`$${lin(c,d)}=0\\Rightarrow x=${va.tex}$`,`Equal degrees: $y=\\frac{${a}}{${c}}=${ha.tex}$`]}}
 const k=Rnz(-6,6),p=Rnz(-6,6),q=Rnz(-6,6);return {type:'fields',prompt:`Find the vertical and horizontal asymptotes of $$f(x)=\\frac{${k}}{x${sg(-p)}}${sg(q)}$$`,fields:[{label:'\\text{VA: }x',name:'the vertical asymptote',ans:p},{label:'\\text{HA: }y',name:'the horizontal asymptote',ans:q}],ansTex:`x=${p},\\;y=${q}`,hint:'This is $\\frac1x$ shifted. Where did the center move?',steps:[`Denominator zero at $x=${p}$`,`As $x\\to\\pm\\infty$ the fraction $\\to0$, so $y\\to${q}$`]}}});

S({id:'remainder',unit:'D',name:'Synthetic division & remainders',pre:['func-eval'],paul:P+'DividingPolynomials.aspx',os:['Precalculus 3.5',OSP+'3-5-dividing-polynomials'],
notes:`<p>Dividing by $x-r$: bring down the first coefficient, multiply by $r$, add to the next, repeat. The last number is the remainder.</p><p><strong>Remainder theorem:</strong> the remainder when $P(x)$ is divided by $x-r$ equals $P(r)$.</p>`,
gen(){const cs=[pick([1,2,-1,3]),R(-6,6),R(-9,9),R(-9,9)];const r=Rnz(-3,3);const row=[cs[0]];for(let i=1;i<4;i++)row.push(cs[i]+row[i-1]*r);
 return {type:'num',val:row[3],ans:String(row[3]),ansTex:String(row[3]),prompt:`Find the remainder when $P(x)=${poly(cs)}$ is divided by $x${sg(-r)}$.`,hint:`Use synthetic division with $r=${r}$, or just compute $P(${r})$.`,
  steps:[`Coefficients: $${cs.join(',\\;')}$, $r=${r}$`,`Synthetic row: $${row.join(',\\;')}$`,`Remainder $=${row[3]}$ (check: $P(${r})=${row[3]}$)`]}}});

S({id:'zeros',unit:'D',name:'Finding zeros of polynomials',pre:['remainder','quad-factor'],paul:P+'FindingZeroesOfPolynomials.aspx',os:['Precalculus 3.6',OSP+'3-6-zeros-of-polynomial-functions'],
notes:`<p><strong>Rational root theorem:</strong> any rational zero is $\\pm\\frac{p}{q}$ with $p$ dividing the constant and $q$ dividing the leading coefficient. Test candidates with synthetic division; each hit lowers the degree.</p><p>Enter all zeros separated by commas.</p>`,
gen(){let r;do{r=[R(-4,4),R(-4,4),R(-4,4)]}while(new Set(r).size<3);let lead=1,roots=r.slice();let cs=polyMul(polyMul([1,-r[0]],[1,-r[1]]),[1,-r[2]]);
 if(Math.random()<.3){const p=pick([1,-1,3,-3]);cs=polyMul(polyMul([1,-r[0]],[1,-r[1]]),[2,-p]);roots=[r[0],r[1],p/2];lead=2}
 const tx=roots.map(v=>frac(Math.round(v*2),2));
 return {type:'set',exact:true,vals:roots,ans:tx.map(t=>t.txt).join(', '),ansTex:tx.map(t=>t.tex).join(',\\;'),prompt:`Find all zeros of $$P(x)=${poly(cs)}$$`,hint:`Candidates: divisors of ${cs[3]||'the constant'} over divisors of ${lead}. Try small integers first.`,
  steps:[`Test candidates; $x=${tx[0].tex}$ gives $P=0$`,`Divide out $(x${sgz(-roots[0])})$ and factor the quadratic that's left`,`Zeros: $${tx.map(t=>t.tex).join(',\\;')}$`]}}});

S({id:'log-eval',unit:'E',name:'Evaluating logarithms',pre:['exp-rat'],paul:P+'LogFunctions.aspx',os:['Precalculus 4.3',OSP+'4-3-logarithmic-functions'],
notes:`$$\\log_b a=c\\iff b^c=a$$<p>Ask: “$b$ to what power gives $a$?” $\\ln$ is base $e$ and $\\log$ with no base is base 10.</p><p>Example: $\\log_4 8=\\tfrac32$ because $4^{3/2}=8$.</p>`,
gen(){const k=R(0,3);let prompt,v,steps;
 if(k===0){const b=pick([2,3,5,10]),e=R(-2,4);const arg=e>=0?String(b**e):`\\frac{1}{${b**-e}}`;prompt=b===10?`\\log ${arg}`:`\\log_{${b}} ${arg}`;v=frac(e);steps=[`$${arg}=${b}^{${e}}$`,`So the log is $${e}$`]}
 else if(k===1){const [b,base,m]=pick([[4,2,2],[8,2,3],[9,3,2],[27,3,3],[16,2,4],[25,5,2]]);let j;do{j=R(-3,5)}while(j===0||j%m===0);const arg=j>0?String(base**j):`\\frac{1}{${base**-j}}`;
  v=frac(j,m);prompt=`\\log_{${b}} ${arg}`;steps=[`Write both as powers of ${base}: $${b}=${base}^{${m}}$, $${arg}=${base}^{${j}}$`,`$(${base}^{${m}})^c=${base}^{${j}}\\Rightarrow ${m}c=${j}$`,`$c=${v.tex}$`]}
 else if(k===2){const e=Rnz(-3,5);const [arg,val]=pick([[`e^{${e}}`,frac(e)],['\\sqrt{e}',frac(1,2)],['\\frac{1}{e}',frac(-1)],[`\\sqrt[3]{e^{${Math.abs(e)}}}`,frac(Math.abs(e),3)]]);prompt=`\\ln ${arg}`;v=val;steps=[`Rewrite as a power of $e$`,`$\\ln e^c=c$, so the value is $${v.tex}$`]}
 else{const j=Rnz(-3,4);const b=pick([2,3]);prompt=`\\log_{1/${b}} ${j>0?b**j:`\\frac{1}{${b**-j}}`}`;v=frac(-j);steps=[`$\\left(\\tfrac1${b}\\right)^c=${b}^{-c}$`,`Need $-c=${j}$, so $c=${-j}$`]}
 return {type:'num',exact:true,val:v.v,ans:v.txt,ansTex:v.tex,prompt:`Evaluate exactly: $$${prompt}$$`,hint:'What power of the base gives the argument?',steps}}});

S({id:'log-props',unit:'E',name:'Logarithm properties',pre:['log-eval'],paul:P+'LogFunctions.aspx',os:['Precalculus 4.5',OSP+'4-5-logarithmic-properties'],
notes:`$$\\log_b(MN)=\\log_b M+\\log_b N\\qquad \\log_b\\tfrac MN=\\log_b M-\\log_b N\\qquad \\log_b M^p=p\\log_b M$$<p>There is no rule for $\\log_b(M+N)$.</p><p>Change of base: $\\log_b a=\\dfrac{\\ln a}{\\ln b}$.</p>`,
gen(){const k=R(0,2);if(k===0){const b=pick([2,3,5,6]),e=R(1,3),B=R(2,9);const A=B*b**e;
  return {type:'num',exact:true,val:e,ans:String(e),ansTex:String(e),prompt:`Evaluate: $$\\log_{${b}} ${A}-\\log_{${b}} ${B}$$`,hint:'Combine into a single log using the quotient rule.',steps:[`$\\log_{${b}}\\frac{${A}}{${B}}=\\log_{${b}}${A/B}$`,`$${A/B}=${b}^{${e}}$, so the value is $${e}$`]}}
 if(k===1){const b=pick([2,3,5,10]),e=R(2,3),m=R(2,3);let c;do{c=R(2,9)}while(gcd(c,b)!==1&&false);const top=b**e*c**m;
  return {type:'num',exact:true,val:e,ans:String(e),ansTex:String(e),prompt:`Evaluate: $$\\log_{${b}} ${top}-${m}\\log_{${b}} ${c}$$`,hint:'Move the coefficient into an exponent first.',steps:[`$${m}\\log_{${b}}${c}=\\log_{${b}}${c**m}$`,`$\\log_{${b}}\\frac{${top}}{${c**m}}=\\log_{${b}}${top/c**m}=${e}$`]}}
 const m=R(2,4),n=R(2,4);const L=(a,b,c)=>`${a}\\ln x${b}\\ln y${c}`;
 const o=[[`${m}\\ln x+\\ln y-${n}\\ln z`,1],[`${m}\\ln x+\\ln y+${n}\\ln z`,0],[`${m}\\ln x\\cdot\\ln y-${n}\\ln z`,0],[`\\ln(${m}x)+\\ln y-\\ln(${n}z)`,0]];
 return {type:'mc',prompt:`Expand: $$\\ln\\frac{x^{${m}}\\,y}{z^{${n}}}$$`,options:shuffle(o.map(([t,ok])=>({tex:`$${t}$`,ok:!!ok}))),ansTex:o[0][0],hint:'Quotient becomes a difference, product becomes a sum, exponents come down in front.',steps:[`$\\ln x^{${m}}+\\ln y-\\ln z^{${n}}$`,`$=${o[0][0]}$`]}}});

S({id:'exp-eq',unit:'E',name:'Exponential equations',pre:['log-props','linear-eq'],paul:P+'SolveExpEqns.aspx',os:['Precalculus 4.6',OSP+'4-6-exponential-and-logarithmic-equations'],
notes:`<p>If both sides can be written with the same base, set the exponents equal. Otherwise isolate the exponential and take $\\ln$ of both sides.</p>$$e^{kx}=A\\;\\Rightarrow\\; x=\\frac{\\ln A}{k}$$<p>Exact answers like <code>ln(7)/3</code> are accepted.</p>`,
gen(){const k=R(0,2);if(k===0){const [B1,B2,base,m,n]=pick([[2,4,2,1,2],[2,8,2,1,3],[4,8,2,2,3],[3,9,3,1,2],[9,27,3,2,3],[5,25,5,1,2]]);let a,b,c;do{a=Rnz(-3,3);b=R(-5,5);c=R(-5,5)}while(m*a===n);
  const x=frac(n*c-m*b,m*a-n);return {type:'num',exact:true,val:x.v,ans:x.txt,ansTex:x.tex,prompt:`Solve: $$${B1}^{${lin(a,b)}}=${B2}^{x${sgz(c)}}$$`,hint:`Rewrite both sides as powers of ${base}.`,
  steps:[`$${base}^{${m}(${lin(a,b)})}=${base}^{${n}(x${sgz(c)})}$`,`$${lin(m*a,m*b)}=${lin(n,n*c)}$`,`$x=${x.tex}$`]}}
 if(k===1){const c=R(2,5),kk=R(2,6),v=c*2**kk;return {type:'num',exact:true,val:kk,ans:String(kk),ansTex:String(kk),prompt:`Solve: $$${c}\\cdot 2^{x}=${v}$$`,hint:`Divide by ${c} first.`,steps:[`$2^x=${2**kk}$`,`$x=${kk}$`]}}
 const kk=R(2,5),A=pick([3,5,6,7,10,12]);return {type:'num',val:Math.log(A)/kk,tol:.002,ans:`ln(${A})/${kk}`,ansTex:`\\frac{\\ln ${A}}{${kk}}\\approx${(Math.log(A)/kk).toFixed(3)}`,prompt:`Solve exactly (or to 3 decimals): $$e^{${kk}x}=${A}$$`,hint:'Take $\\ln$ of both sides.',steps:[`$${kk}x=\\ln ${A}$`,`$x=\\frac{\\ln ${A}}{${kk}}\\approx${(Math.log(A)/kk).toFixed(3)}$`]}}});

const LOGQ=[];for(const b of [2,3])for(let k=2;k<=6;k++)for(let d=1;d<=8;d++){const D=d*d+4*b**k,s=Math.round(Math.sqrt(D));if(s*s===D&&(d+s)%2===0&&b**k<=250)LOGQ.push([b,k,d,(d+s)/2,(d-s)/2])}
S({id:'log-eq',unit:'E',name:'Logarithmic equations',pre:['log-props','quad-factor'],paul:P+'SolveLogEqns.aspx',os:['Precalculus 4.6',OSP+'4-6-exponential-and-logarithmic-equations'],
notes:`<p>Combine into a single log, then convert to exponential form: $\\log_b M=c\\iff M=b^c$.</p><p>Every candidate must make each log's argument <strong>positive</strong> in the original equation. Discard any that don't.</p>`,
gen(){if(Math.random()<.55){const [b,k,d,x1,x2]=pick(LOGQ);return {type:'set',exact:true,vals:[x1],ans:String(x1),ansTex:`x=${x1}`,prompt:`Solve: $$\\log_{${b}} x+\\log_{${b}}(x-${d})=${k}$$`,hint:'Product rule, then rewrite in exponential form. Check for extraneous answers.',
  steps:[`$\\log_{${b}}\\big(x(x-${d})\\big)=${k}$`,`$x^2-${d}x=${b**k}$`,`$(x-${x1})(x${sg(-x2)})=0$`,`$x=${x2}$ makes $\\log_{${b}}x$ undefined, so only $x=${x1}$`]}}
 const b=pick([2,3,5]),k=R(1,3),a=R(1,5),c=R(-9,9);const x=frac(b**k-c,a);return {type:'num',exact:true,val:x.v,ans:x.txt,ansTex:x.tex,prompt:`Solve: $$\\log_{${b}}(${lin(a,c)})=${k}$$`,hint:'Rewrite in exponential form.',steps:[`$${lin(a,c)}=${b}^{${k}}=${b**k}$`,`$x=${x.tex}$`]}}});

S({id:'interest',unit:'E',name:'Growth & compound interest',pre:['exp-eq'],paul:P+'ExpLogApplications.aspx',os:['Precalculus 4.7',OSP+'4-7-exponential-and-logarithmic-models'],
notes:`$$A=P\\left(1+\\frac rn\\right)^{nt}\\qquad A=Pe^{rt}\\text{ (continuous)}$$<p>$P$ = principal, $r$ = annual rate as a decimal, $n$ = compounds per year, $t$ = years. Use a calculator and round to 2 decimals.</p>`,
gen(){const P=pick([500,1000,1500,2500,5000,10000]),rp=pick([3,4,5,6,7,8,9]),r=rp/100,t=R(2,10);const k=R(0,2);
 if(k===0){const [n,nm]=pick([[1,'annually'],[4,'quarterly'],[12,'monthly']]);const A=P*(1+r/n)**(n*t);return {type:'num',val:A,tol:.011,ans:r2(A).toFixed(2),ansTex:money(A),prompt:`You invest $${money(P)}$ at ${rp}% per year, compounded ${nm}. How much is it worth after ${t} years? (Round to the cent.)`,hint:`$n=${n}$, $r=${r}$.`,
  steps:[`$A=${P}\\left(1+\\frac{${r}}{${n}}\\right)^{${n}\\cdot${t}}$`,`$A\\approx${money(A)}$`]}}
 if(k===1){const A=P*Math.exp(r*t);return {type:'num',val:A,tol:.011,ans:r2(A).toFixed(2),ansTex:money(A),prompt:`$${money(P)}$ earns ${rp}% compounded continuously. What is it worth after ${t} years? (Round to the cent.)`,hint:'$A=Pe^{rt}$.',steps:[`$A=${P}e^{${r}\\cdot${t}}$`,`$A\\approx${money(A)}$`]}}
 const T=Math.log(2)/r;return {type:'num',val:T,tol:.011,ans:r2(T).toFixed(2),ansTex:r2(T).toFixed(2),prompt:`How many years for money to double at ${rp}% compounded continuously? (Round to 2 decimals.)`,hint:'Set $2P=Pe^{rt}$; $P$ cancels.',steps:[`$2=e^{${r}t}$`,`$t=\\frac{\\ln 2}{${r}}\\approx${r2(T).toFixed(2)}$ years`]}}});

S({id:'systems',unit:'F',name:'Linear systems (2 variables)',pre:['linear-eq'],paul:P+'SystemsTwoVrble.aspx',os:['Precalculus 9.1',OSP+'9-1-systems-of-linear-equations-two-variables'],
notes:`<p><strong>Substitution:</strong> solve one equation for a variable and plug it into the other. <strong>Elimination:</strong> scale the equations so one variable cancels when you add them.</p><p>Always check your pair in both original equations.</p>`,
gen(){let a1,b1,a2,b2,x,y;do{a1=Rnz(-5,5);b1=Rnz(-5,5);a2=Rnz(-5,5);b2=Rnz(-5,5);x=R(-6,6);y=R(-6,6)}while(a1*b2-a2*b1===0);const c1=a1*x+b1*y,c2=a2*x+b2*y;
 const eq=(a,b,c)=>`${lin(a,0).replace(/ \+ 0$/,'')}${b<0?' - ':' + '}${Math.abs(b)===1?'':Math.abs(b)}y&=${c}`;
 return {type:'fields',prompt:`Solve the system: $$\\begin{aligned}${eq(a1,b1,c1)}\\\\${eq(a2,b2,c2)}\\end{aligned}$$`,fields:[{label:'x',name:'x',ans:x},{label:'y',name:'y',ans:y}],ansTex:`(${x},${y})`,hint:'Pick a variable to eliminate and scale both equations to match its coefficients.',
  steps:[`Multiply eq. 1 by $${a2}$ and eq. 2 by $${a1}$, then subtract to eliminate $x$`,`$${a2*b1-a1*b2}y=${a2*c1-a1*c2}\\Rightarrow y=${y}$`,`Back-substitute: $x=${x}$`]}}});

S({id:'deg-rad',unit:'G',name:'Degrees & radians',pre:[],paul:PT+'TrigFunctions.aspx',os:['Precalculus 5.1',OSP+'5-1-angles'],
notes:`$$180^\\circ=\\pi\\text{ rad}\\qquad \\text{deg}\\to\\text{rad: }\\times\\frac{\\pi}{180}\\qquad \\text{rad}\\to\\text{deg: }\\times\\frac{180}{\\pi}$$<p>Know the landmarks: $30^\\circ=\\frac\\pi6$, $45^\\circ=\\frac\\pi4$, $60^\\circ=\\frac\\pi3$, $90^\\circ=\\frac\\pi2$. Type <code>pi</code> or <code>π</code>.</p>`,
gen(){const d=pick([6,4,3,2,12]);let n;do{n=R(-2*d,4*d)}while(n===0||gcd(n,d)!==1&&d!==1);const deg=n*180/d;
 if(Math.random()<.5)return {type:'num',exact:true,val:n*Math.PI/d,ans:piTxt(n,d),ansTex:piTex(n,d),prompt:`Convert $${deg}^\\circ$ to radians (exact).`,hint:'Multiply by $\\frac{\\pi}{180}$ and reduce.',steps:[`$${deg}\\cdot\\frac{\\pi}{180}=${piTex(n,d)}$`]};
 return {type:'num',val:deg,ans:String(deg),ansTex:`${deg}^\\circ`,prompt:`Convert $${piTex(n,d)}$ radians to degrees.`,hint:'Multiply by $\\frac{180}{\\pi}$.',steps:[`$${piTex(n,d)}\\cdot\\frac{180^\\circ}{\\pi}=${deg}^\\circ$`]}}});

const TF={sin:Math.sin,cos:Math.cos,tan:Math.tan,sec:x=>1/Math.cos(x),csc:x=>1/Math.sin(x),cot:x=>Math.cos(x)/Math.sin(x)};
S({id:'unit-circle',unit:'G',name:'Unit circle values',pre:['deg-rad'],paul:PT+'TrigFunctions.aspx',os:['Precalculus 5.2',OSP+'5-2-unit-circle-sine-and-cosine-functions'],
notes:`<p>On the unit circle the point at angle $\\theta$ is $(\\cos\\theta,\\sin\\theta)$. Find the reference angle, take the value from the first quadrant, then fix the sign by quadrant.</p><p>Signs: all positive in Q1, $\\sin$ in Q2, $\\tan$ in Q3, $\\cos$ in Q4. Undefined values: type <code>undefined</code>.</p>`,
gen(){const d=pick([6,4,3,2,6,4,3]);let n;do{n=R(-2*d,4*d)}while(gcd(n,d)!==1&&!(n===0));const f=pick(['sin','cos','tan','sin','cos','sec','csc','cot']);const th=n*Math.PI/d;
 const s=Math.sin(th),c=Math.cos(th);const und=(['tan','sec'].includes(f)&&Math.abs(c)<1e-9)||(['cot','csc'].includes(f)&&Math.abs(s)<1e-9);let v=und?NaN:TF[f](th);if(Math.abs(v)<1e-12)v=0;
 const ex=und?null:exactOf(v);const m=((th%(2*Math.PI))+2*Math.PI)%(2*Math.PI);const q=m<Math.PI/2?1:m<Math.PI?2:m<3*Math.PI/2?3:4;const on=Math.abs(Math.sin(2*m))<1e-9;
 return {type:'num',exact:true,undef:und,val:v,ans:und?'undefined':ex.txt,ansTex:und?'\\text{undefined}':ex.tex,prompt:`Find the exact value: $$\\${f}\\left(${piTex(n,d)}\\right)$$`,hint:'Find the coterminal angle in $[0,2\\pi)$, then use the reference angle and quadrant sign.',
  steps:[`Point on the circle: $(\\cos\\theta,\\sin\\theta)=\\left(${exactOf(c).tex},\\,${exactOf(s).tex}\\right)$`,on?'The angle lies on an axis':`Quadrant ${q}`,`$\\${f}\\left(${piTex(n,d)}\\right)=${und?'\\text{undefined}':ex.tex}$`]}}});

function triSVG(lab){ // right angle at C (bottom-right), angle θ at A (bottom-left)
 return `<svg class="fig" viewBox="0 0 260 150" role="img" aria-label="Right triangle"><polygon points="20,130 230,130 230,25" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="218,130 218,118 230,118" fill="none" stroke="currentColor" stroke-width="1.5"/>
 <path d="M 58 130 A 38 38 0 0 0 55.5 113" fill="none" stroke="var(--accent)" stroke-width="2"/><text x="64" y="124" class="fl">${lab.th}</text>
 <text x="125" y="146" text-anchor="middle" class="fl">${lab.adj}</text><text x="240" y="82" class="fl">${lab.opp}</text><text x="110" y="68" text-anchor="end" class="fl">${lab.hyp}</text></svg>`}
S({id:'right-tri',unit:'G',name:'Right-triangle trig',pre:['unit-circle'],paul:PT+'TrigFunctions.aspx',os:['Precalculus 5.4',OSP+'5-4-right-triangle-trigonometry'],
notes:`$$\\sin\\theta=\\frac{\\text{opp}}{\\text{hyp}}\\qquad\\cos\\theta=\\frac{\\text{adj}}{\\text{hyp}}\\qquad\\tan\\theta=\\frac{\\text{opp}}{\\text{adj}}$$<p>Pick the ratio that links the side you know to the side you want. Make sure your calculator is in degree mode for these.</p>`,
gen(){const th=R(15,75),kind=R(0,3);const rad=th*Math.PI/180;let known,val,lab,steps,want;
 if(kind===0){const h=R(5,30);val=h*Math.sin(rad);lab={th:th+'°',adj:'',opp:'x',hyp:String(h)};steps=[`Opposite and hypotenuse: use $\\sin$`,`$x=${h}\\sin ${th}^\\circ\\approx${val.toFixed(2)}$`]}
 else if(kind===1){const h=R(5,30);val=h*Math.cos(rad);lab={th:th+'°',adj:'x',opp:'',hyp:String(h)};steps=[`Adjacent and hypotenuse: use $\\cos$`,`$x=${h}\\cos ${th}^\\circ\\approx${val.toFixed(2)}$`]}
 else if(kind===2){const a=R(4,25);val=a*Math.tan(rad);lab={th:th+'°',adj:String(a),opp:'x',hyp:''};steps=[`Opposite and adjacent: use $\\tan$`,`$x=${a}\\tan ${th}^\\circ\\approx${val.toFixed(2)}$`]}
 else{const o=R(4,25);val=o/Math.sin(rad);lab={th:th+'°',adj:'',opp:String(o),hyp:'x'};steps=[`Opposite known, hypotenuse wanted: $\\sin ${th}^\\circ=\\frac{${o}}{x}$`,`$x=\\frac{${o}}{\\sin ${th}^\\circ}\\approx${val.toFixed(2)}$`]}
 return {type:'num',val,tol:.011,ans:val.toFixed(2),ansTex:val.toFixed(2),prompt:`Find $x$. Round to 2 decimals.${triSVG(lab)}`,hint:'Label the sides relative to the marked angle: opposite, adjacent, hypotenuse.',steps}}});

S({id:'inv-trig',unit:'G',name:'Inverse trig functions',pre:['unit-circle'],paul:PT+'InverseTrig.aspx',os:['Precalculus 6.3',OSP+'6-3-inverse-trigonometric-functions'],
notes:`<p>Each inverse returns one angle from a fixed range:</p>$$\\sin^{-1}:\\left[-\\tfrac\\pi2,\\tfrac\\pi2\\right]\\qquad\\cos^{-1}:[0,\\pi]\\qquad\\tan^{-1}:\\left(-\\tfrac\\pi2,\\tfrac\\pi2\\right)$$<p>So $\\sin^{-1}\\!\\left(-\\tfrac12\\right)=-\\tfrac\\pi6$, not $\\tfrac{7\\pi}6$.</p>`,
gen(){const f=pick(['sin','cos','tan']);const vals=f==='tan'?[-S3,-1,-S3/3,0,S3/3,1,S3]:[-1,-S3/2,-S2/2,-.5,0,.5,S2/2,S3/2,1];const x=pick(vals);const ang={sin:Math.asin,cos:Math.acos,tan:Math.atan}[f](x);
 let n,d;for(d of [1,2,3,4,6]){n=Math.round(ang/Math.PI*d);if(Math.abs(n/d*Math.PI-ang)<1e-9)break}const range={sin:'\\left[-\\frac\\pi2,\\frac\\pi2\\right]',cos:'[0,\\pi]',tan:'\\left(-\\frac\\pi2,\\frac\\pi2\\right)'}[f];
 return {type:'num',exact:true,val:ang,ans:piTxt(n,d),ansTex:piTex(n,d),prompt:`Find the exact value in radians: $$\\${f}^{-1}\\left(${exactOf(x).tex}\\right)$$`,hint:`The answer must lie in $${range}$.`,steps:[`Which angle in $${range}$ has $\\${f}=${exactOf(x).tex}$?`,`$${piTex(n,d)}$`]}}});

S({id:'trig-graphs',unit:'G',name:'Graphs of sine & cosine',pre:['unit-circle'],paul:PT+'TrigGraphs.aspx',os:['Precalculus 6.1',OSP+'6-1-graphs-of-the-sine-and-cosine-functions'],
notes:`$$y=A\\sin(Bx-C)+D$$<p>Amplitude $|A|$, period $\\frac{2\\pi}{B}$, phase shift $\\frac{C}{B}$ (to the right when positive), midline $y=D$. Factor out $B$ to see the shift: $\\sin(2x-\\frac\\pi2)=\\sin 2(x-\\frac\\pi4)$.</p>`,
gen(){const A=pick([1,2,3,4,-2,-3,.5]),B=pick([1,2,3,4]),D=R(-4,4);const [sn,sd]=pick([[1,2],[1,3],[1,4],[1,6],[-1,4],[-1,3],[-1,2],[2,3]]);const f=pick(['sin','cos']);
 const Cn=B*sn,Cd=sd;const shift=frac(sn,sd);const per=frac(2,B);const inner=`${B===1?'':B}x${Cn>0?'-':'+'}${piTex(Math.abs(Cn),Cd)}`;const At=A===.5?'\\frac12':A===1?'':A===-1?'-':A;
 return {type:'fields',prompt:`For $$y=${At}\\${f}\\left(${inner}\\right)${sgz(D)}$$ find the amplitude, period, phase shift (positive = right) and midline.`,
  fields:[{label:'\\text{Amplitude}',name:'the amplitude',ans:Math.abs(A)},{label:'\\text{Period}',name:'the period',ans:per.v*Math.PI,ansTex:piTex(per.n,per.d)},{label:'\\text{Phase shift}',name:'the phase shift',ans:shift.v*Math.PI,ansTex:piTex(shift.n,shift.d)},{label:'\\text{Midline }y',name:'the midline',ans:D}],
  ansTex:`${Math.abs(A)},\\;${piTex(per.n,per.d)},\\;${piTex(shift.n,shift.d)},\\;y=${D}`,hint:'Factor $B$ out of the inside to read the phase shift.',
  steps:[`Amplitude $|${A}|=${Math.abs(A)}$`,`Period $\\frac{2\\pi}{${B}}=${piTex(per.n,per.d)}$`,`Inside $=${B}\\left(x${sn>0?'-':'+'}${piTex(Math.abs(sn),sd)}\\right)$, so the shift is $${piTex(shift.n,shift.d)}$`,`Midline $y=${D}$`]}}});

const IDS=[['\\sec x-\\tan x\\sin x','\\cos x',['sec x = 1/cos x and tan x = sin x / cos x','Combine: (1 - sin²x)/cos x = cos²x/cos x']],['\\frac{1-\\cos^2 x}{\\sin x}','\\sin x',['1 - cos²x = sin²x','sin²x / sin x = sin x']],
 ['\\tan x\\cos x','\\sin x',['tan x = sin x/cos x','The cos x cancels']],['\\frac{\\sin^2 x}{1-\\cos x}','1+\\cos x',['sin²x = 1 - cos²x = (1-cos x)(1+cos x)','Cancel (1 - cos x)']],
 ['\\sec^2 x-1','\\tan^2 x',['Pythagorean identity: 1 + tan²x = sec²x']],['\\cot x\\sec x','\\csc x',['(cos x/sin x)(1/cos x) = 1/sin x']],['\\sin x\\cot x+\\cos x','2\\cos x',['sin x · cos x/sin x = cos x','cos x + cos x = 2cos x']],
 ['(1+\\tan^2 x)\\cos^2 x','1',['1 + tan²x = sec²x','sec²x · cos²x = 1']],['\\frac{\\csc x}{\\sec x}','\\cot x',['(1/sin x)/(1/cos x) = cos x/sin x']],['\\cos^4x-\\sin^4x','\\cos 2x',['Difference of squares: (cos²x - sin²x)(cos²x + sin²x)','= cos²x - sin²x = cos 2x']]];
const IDPOOL=['\\sin x','\\cos x','\\tan x','\\csc x','\\sec x','\\cot x','1','\\tan^2 x','1+\\cos x','2\\cos x','\\cos 2x','\\sin 2x','1-\\sin x'];
S({id:'identities',unit:'H',name:'Simplifying with identities',pre:['unit-circle'],paul:PT+'TrigFormulas.aspx',os:['Precalculus 7.1',OSP+'7-1-simplifying-and-verifying-trigonometric-identities'],
notes:`$$\\sin^2x+\\cos^2x=1\\qquad 1+\\tan^2x=\\sec^2x\\qquad 1+\\cot^2x=\\csc^2x$$<p>Strategy: rewrite everything in sines and cosines, combine fractions, then look for a Pythagorean identity or a factorable pattern.</p>`,
gen(){const [e,a,st]=pick(IDS);const wrong=shuffle(IDPOOL.filter(x=>x!==a)).slice(0,3);return {type:'mc',prompt:`Simplify: $$${e}$$`,options:shuffle([{tex:`$${a}$`,ok:true},...wrong.map(w=>({tex:`$${w}$`,ok:false}))]),ansTex:a,hint:'Rewrite in terms of sine and cosine.',steps:st.concat([`Result: $${a}$`])}}});

S({id:'sum-diff',unit:'H',name:'Sum & difference formulas',pre:['identities'],paul:PT+'TrigFormulas.aspx',os:['Precalculus 7.2',OSP+'7-2-sum-and-difference-identities'],
notes:`$$\\sin(A\\pm B)=\\sin A\\cos B\\pm\\cos A\\sin B$$$$\\cos(A\\pm B)=\\cos A\\cos B\\mp\\sin A\\sin B$$$$\\tan(A\\pm B)=\\frac{\\tan A\\pm\\tan B}{1\\mp\\tan A\\tan B}$$<p>Split the angle into two you know, like $75^\\circ=45^\\circ+30^\\circ$.</p>`,
gen(){const [ang,A,B,op]=pick([[15,45,30,'-'],[75,45,30,'+'],[105,60,45,'+'],[165,120,45,'+'],[195,150,45,'+'],[255,210,45,'+'],[285,240,45,'+']]);const f=pick(['sin','cos','tan']);const v=TF[f](ang*Math.PI/180);const ex=exactOf(v);
 const form={sin:`\\sin ${A}^\\circ\\cos ${B}^\\circ${op}\\cos ${A}^\\circ\\sin ${B}^\\circ`,cos:`\\cos ${A}^\\circ\\cos ${B}^\\circ${op==='+'?'-':'+'}\\sin ${A}^\\circ\\sin ${B}^\\circ`,tan:`\\frac{\\tan ${A}^\\circ${op}\\tan ${B}^\\circ}{1${op==='+'?'-':'+'}\\tan ${A}^\\circ\\tan ${B}^\\circ}`}[f];
 return {type:'num',exact:true,val:v,ans:ex.txt,ansTex:ex.tex,prompt:`Find the exact value: $$\\${f} ${ang}^\\circ$$`,hint:`Write $${ang}^\\circ=${A}^\\circ${op}${B}^\\circ$.`,steps:[`$${ang}^\\circ=${A}^\\circ${op}${B}^\\circ$`,`$\\${f} ${ang}^\\circ=${form}$`,`$=${ex.tex}$`]}}});

S({id:'double-angle',unit:'H',name:'Double-angle formulas',pre:['sum-diff','right-tri'],paul:PT+'TrigFormulas.aspx',os:['Precalculus 7.3',OSP+'7-3-double-angle-half-angle-and-reduction-formulas'],
notes:`$$\\sin2\\theta=2\\sin\\theta\\cos\\theta\\qquad\\cos2\\theta=\\cos^2\\theta-\\sin^2\\theta\\qquad\\tan2\\theta=\\frac{2\\tan\\theta}{1-\\tan^2\\theta}$$<p>Given one ratio and the quadrant, sketch a reference triangle to get the others, then fix signs using the quadrant.</p>`,
gen(){const [a,b,c]=pick([[3,4,5],[5,12,13],[8,15,17],[7,24,25]]);const q=R(1,4);const giveSin=Math.random()<.5;const sx=[1,1,-1,-1][q-1],sy=[1,-1,-1,1][q-1];
 const s=frac(sx*(giveSin?a:b),c),co=frac(sy*(giveSin?b:a),c);const f=pick(['sin','cos','tan']);let r;if(f==='sin')r=frac(2*s.n*co.n,c*c);else if(f==='cos')r=frac(co.n*co.n-s.n*s.n,c*c);else r=frac(2*s.n*co.n,co.n*co.n-s.n*s.n);
 const qn=['I','II','III','IV'][q-1];return {type:'num',exact:true,val:r.v,ans:r.txt,ansTex:r.tex,prompt:`Given $${giveSin?'\\sin':'\\cos'}\\theta=${giveSin?s.tex:co.tex}$ with $\\theta$ in quadrant ${qn}, find $\\${f}2\\theta$.`,hint:`Use a ${a}-${b}-${c} triangle and quadrant ${qn} signs to get the other ratio.`,
  steps:[`$\\sin\\theta=${s.tex}$, $\\cos\\theta=${co.tex}$ (quadrant ${qn})`,f==='sin'?`$2\\sin\\theta\\cos\\theta=2\\left(${s.tex}\\right)\\left(${co.tex}\\right)$`:f==='cos'?`$\\cos^2\\theta-\\sin^2\\theta=\\frac{${co.n*co.n}}{${c*c}}-\\frac{${s.n*s.n}}{${c*c}}$`:`$\\tan2\\theta=\\frac{\\sin2\\theta}{\\cos2\\theta}$`,`$=${r.tex}$`]}}});

const TEQ=[['2\\sin x-1=0',x=>2*Math.sin(x)-1,'\\sin x=\\frac12'],['2\\sin x+\\sqrt3=0',x=>2*Math.sin(x)+S3,'\\sin x=-\\frac{\\sqrt3}{2}'],['2\\cos x-\\sqrt2=0',x=>2*Math.cos(x)-S2,'\\cos x=\\frac{\\sqrt2}{2}'],
 ['2\\cos x+1=0',x=>2*Math.cos(x)+1,'\\cos x=-\\frac12'],['\\tan x+1=0',x=>Math.tan(x)+1,'\\tan x=-1'],['\\sqrt3\\tan x-1=0',x=>S3*Math.tan(x)-1,'\\tan x=\\frac{\\sqrt3}{3}'],
 ['2\\sin^2x-\\sin x-1=0',x=>2*Math.sin(x)**2-Math.sin(x)-1,'(2\\sin x+1)(\\sin x-1)=0'],['2\\cos^2x+3\\cos x+1=0',x=>2*Math.cos(x)**2+3*Math.cos(x)+1,'(2\\cos x+1)(\\cos x+1)=0'],
 ['4\\sin^2x-3=0',x=>4*Math.sin(x)**2-3,'\\sin x=\\pm\\frac{\\sqrt3}{2}'],['\\cos^2x-\\cos x=0',x=>Math.cos(x)**2-Math.cos(x),'\\cos x(\\cos x-1)=0'],['2\\sin x\\cos x=\\cos x',x=>2*Math.sin(x)*Math.cos(x)-Math.cos(x),'\\cos x(2\\sin x-1)=0'],['\\tan^2x=3',x=>Math.tan(x)**2-3,'\\tan x=\\pm\\sqrt3']];
S({id:'trig-eq',unit:'H',name:'Solving trig equations',pre:['inv-trig','identities'],paul:PT+'SolveTrigEqn.aspx',os:['Precalculus 7.5',OSP+'7-5-solving-trigonometric-equations'],
notes:`<p>Isolate the trig function (factor if it's quadratic in $\\sin$ or $\\cos$). Find the reference angle, then list every angle in $[0,2\\pi)$ with the right sign.</p><p>Never divide both sides by $\\cos x$: you'd lose the solutions where $\\cos x=0$. Factor instead.</p>`,
gen(){const [e,f,st]=pick(TEQ);const sol=[];for(let k=0;k<24;k++){const x=k*Math.PI/12;const v=f(x);if(isFinite(v)&&Math.abs(v)<1e-9)sol.push(k)}const tx=sol.map(k=>piTex(k,12)),tt=sol.map(k=>piTxt(k,12));
 return {type:'set',exact:true,vals:sol.map(k=>k*Math.PI/12),ans:tt.join(', '),ansTex:tx.join(',\\;'),prompt:`Solve on $[0,2\\pi)$: $$${e}$$`,hint:'Isolate or factor, then find every matching angle on the unit circle.',steps:[`$${st}$`,`Angles in $[0,2\\pi)$: $${tx.join(',\\;')}$`]}}});

S({id:'oblique',unit:'H',name:'Law of sines & cosines',pre:['right-tri'],paul:PT+'TrigFormulas.aspx',os:['Precalculus 8.1',OSP+'8-1-non-right-triangles-law-of-sines'],
notes:`$$\\frac{a}{\\sin A}=\\frac{b}{\\sin B}=\\frac{c}{\\sin C}\\qquad c^2=a^2+b^2-2ab\\cos C$$<p>Use the law of sines when you know an angle and its opposite side. Use the law of cosines for SAS (two sides and the angle between) or SSS.</p>`,
gen(){if(Math.random()<.5){const b=R(4,20),c=R(4,20),A=R(25,140);const a=Math.sqrt(b*b+c*c-2*b*c*Math.cos(A*Math.PI/180));
  return {type:'num',val:a,tol:.011,ans:a.toFixed(2),ansTex:a.toFixed(2),prompt:`In triangle $ABC$, $b=${b}$, $c=${c}$ and $A=${A}^\\circ$. Find $a$ (2 decimals).`,hint:'Two sides and the included angle: law of cosines.',steps:[`$a^2=${b}^2+${c}^2-2(${b})(${c})\\cos ${A}^\\circ$`,`$a\\approx${a.toFixed(2)}$`]}}
 let A,B;do{A=R(25,100);B=R(20,90)}while(A+B>165);const a=R(5,25);const b=a*Math.sin(B*Math.PI/180)/Math.sin(A*Math.PI/180);
 return {type:'num',val:b,tol:.011,ans:b.toFixed(2),ansTex:b.toFixed(2),prompt:`In triangle $ABC$, $A=${A}^\\circ$, $B=${B}^\\circ$ and $a=${a}$. Find $b$ (2 decimals).`,hint:'You know an angle-side pair: law of sines.',steps:[`$\\frac{b}{\\sin ${B}^\\circ}=\\frac{${a}}{\\sin ${A}^\\circ}$`,`$b=\\frac{${a}\\sin ${B}^\\circ}{\\sin ${A}^\\circ}\\approx${b.toFixed(2)}$`]}}});

const SKM=Object.fromEntries(SK.map(s=>[s.id,s]));
if(typeof module!=='undefined')module.exports={SK,SKM,check,parse,toTex,ev,UNITS,noParenReject,factoredReject,radReject,singleFractionReject,REJECTS};
