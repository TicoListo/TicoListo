#!/usr/bin/env python3
import struct, hashlib, zlib, zipfile, os, subprocess, shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'build'
OUT.mkdir(exist_ok=True)

# ---------------- Binary AndroidManifest.xml writer ----------------
RES_STRING_POOL=0x0001; RES_XML_RESOURCE_MAP=0x0180
RES_XML_START_ELEMENT=0x0102; RES_XML_END_ELEMENT=0x0103
RES_XML_TYPE=0x0003; RES_XML_START_NS=0x0100; RES_XML_END_NS=0x0101
T_STRING=0x03; T_INT_DEC=0x10; T_INT_BOOL=0x12
ANDROID_NS='http://schemas.android.com/apk/res/android'
RID_LABEL=0x01010001; RID_NAME=0x01010003; RID_EXPORTED=0x01010010
RID_MINSDK=0x0101020C; RID_TARGETSDK=0x01010270; RID_ALLOWBACKUP=0x01010280
RID_VERSIONCODE=0x0101021B; RID_VERSIONNAME=0x0101021C; RID_CLEARTEXT=0x01010604

def _enc_len8(n):
    return bytes([((n>>8)&0x7f)|0x80,n&0xff]) if n>0x7f else bytes([n&0x7f])

def _enc_string_pool(strings):
    offsets=[]; blob=bytearray()
    for s in strings:
        offsets.append(len(blob)); b=s.encode('utf-8')
        blob += _enc_len8(len(s)) + _enc_len8(len(b)) + b + b'\x00'
    while len(blob)%4: blob.append(0)
    hs=28; ss=hs+4*len(strings)
    out=bytearray(struct.pack('<HHI',RES_STRING_POOL,hs,ss+len(blob)))
    out += struct.pack('<IIIII',len(strings),0,0x100,ss,0)
    for o in offsets: out += struct.pack('<I',o)
    return bytes(out+blob)

def encode_axml(ir):
    rp=ir['resid']; pool=[s for s,_ in rp]; resids=[r for _,r in rp]
    residx={r:i for i,(_,r) in enumerate(rp)}; sidx={}
    for i,s in enumerate(pool): sidx.setdefault(s,i)
    def intern(s):
        if s is not None and s not in sidx: sidx[s]=len(pool); pool.append(s)
    for ev in ir['events']:
        if ev[0] in ('ns_start','ns_end'): intern(ev[2]); intern(ev[3])
        elif ev[0]=='start':
            intern(ev[2]); intern(ev[3])
            for a in ev[4]:
                intern(a['ns'])
                if a['resid'] is None: intern(a['name'])
                if a['vtype']==T_STRING: intern(a['vstr'])
        elif ev[0]=='end': intern(ev[2]); intern(ev[3])
    def ref(s): return sidx[s] if s is not None else 0xffffffff
    nodes=bytearray()
    for ev in ir['events']:
        if ev[0] in ('ns_start','ns_end'):
            c=RES_XML_START_NS if ev[0]=='ns_start' else RES_XML_END_NS
            nodes += struct.pack('<HHI',c,16,24)+struct.pack('<IIII',ev[1],0xffffffff,ref(ev[2]),ref(ev[3]))
        elif ev[0]=='start':
            _,line,ns,tag,attrs,id_i,class_i,style_i=ev
            body=bytearray(struct.pack('<II',ref(ns),ref(tag)))
            body += struct.pack('<HHH',20,20,len(attrs))+struct.pack('<HHH',id_i,class_i,style_i)
            for a in attrs:
                aname=residx[a['resid']] if a['resid'] is not None else sidx[a['name']]
                if a['vtype']==T_STRING: vdata=sidx[a['vstr']]; raw=vdata
                else: vdata=a['vdata']; raw=0xffffffff
                body += struct.pack('<III',ref(a['ns']),aname,raw)
                body += struct.pack('<HBBI',8,0,a['vtype'],vdata)
            nodes += struct.pack('<HHI',RES_XML_START_ELEMENT,16,16+len(body))+struct.pack('<II',line,0xffffffff)+body
        elif ev[0]=='end':
            nodes += struct.pack('<HHI',RES_XML_END_ELEMENT,16,24)+struct.pack('<IIII',ev[1],0xffffffff,ref(ev[2]),ref(ev[3]))
    sp=_enc_string_pool(pool)
    rm=struct.pack('<HHI',RES_XML_RESOURCE_MAP,8,8+4*len(resids))+b''.join(struct.pack('<I',r) for r in resids)
    body=sp+rm+bytes(nodes)
    return struct.pack('<HHI',RES_XML_TYPE,8,8+len(body))+body

def A(name,rid,vtype,vdata=0,vstr=None,ns=ANDROID_NS):
    return {'ns':ns,'name':name,'resid':rid,'vtype':vtype,'vdata':vdata,'vstr':vstr}
def U(name,vstr): return {'ns':None,'name':name,'resid':None,'vtype':T_STRING,'vdata':0,'vstr':vstr}
def S(tag,attrs=[]): return ('start',1,None,tag,attrs,0,0,0)
def E(tag): return ('end',1,None,tag)

def make_manifest():
    resid=[('label',RID_LABEL),('name',RID_NAME),('exported',RID_EXPORTED),('minSdkVersion',RID_MINSDK),('targetSdkVersion',RID_TARGETSDK),('allowBackup',RID_ALLOWBACKUP),('versionCode',RID_VERSIONCODE),('versionName',RID_VERSIONNAME),('usesCleartextTraffic',RID_CLEARTEXT)]
    ev=[('ns_start',1,'android',ANDROID_NS),
        S('manifest',[U('package','cr.ticolisto.app'),A('versionCode',RID_VERSIONCODE,T_INT_DEC,1),A('versionName',RID_VERSIONNAME,T_STRING,vstr='0.1.0')]),
        S('uses-sdk',[A('minSdkVersion',RID_MINSDK,T_INT_DEC,23),A('targetSdkVersion',RID_TARGETSDK,T_INT_DEC,29)]),E('uses-sdk'),
        S('uses-permission',[A('name',RID_NAME,T_STRING,vstr='android.permission.INTERNET')]),E('uses-permission'),
        S('application',[A('label',RID_LABEL,T_STRING,vstr='TicoListo'),A('allowBackup',RID_ALLOWBACKUP,T_INT_BOOL,0),A('usesCleartextTraffic',RID_CLEARTEXT,T_INT_BOOL,0)]),
          S('activity',[A('name',RID_NAME,T_STRING,vstr='cr.ticolisto.app.MainActivity'),A('exported',RID_EXPORTED,T_INT_BOOL,0xffffffff)]),
            S('intent-filter'),
              S('action',[A('name',RID_NAME,T_STRING,vstr='android.intent.action.MAIN')]),E('action'),
              S('category',[A('name',RID_NAME,T_STRING,vstr='android.intent.category.LAUNCHER')]),E('category'),
            E('intent-filter'),
          E('activity'),
        E('application'),E('manifest'),('ns_end',1,'android',ANDROID_NS)]
    return encode_axml({'resid':resid,'events':ev})

# ---------------- Minimal DEX 035 writer ----------------
NO_INDEX=0xffffffff

def uleb(n):
    out=bytearray()
    while True:
        b=n&0x7f; n >>= 7
        if n: out.append(b|0x80)
        else: out.append(b); return bytes(out)

def align4(n): return (n+3)&~3

def make_dex():
    C='Lcr/ticolisto/app/MainActivity;'; ACT='Landroid/app/Activity;'; BUNDLE='Landroid/os/Bundle;'
    WV='Landroid/webkit/WebView;'; WS='Landroid/webkit/WebSettings;'; CTX='Landroid/content/Context;'
    VIEW='Landroid/view/View;'; STR='Ljava/lang/String;'; VOID='V'; BOOL='Z'
    URL='file:///android_asset/index.html'
    protos=[
      (VOID,()),(VOID,(BUNDLE,)),(VOID,(CTX,)),(WS,()),(VOID,(BOOL,)),(VOID,(STR,)),(VOID,(VIEW,))
    ]
    # class, name, proto
    methods=[
      (ACT,'<init>',(VOID,())),(ACT,'onCreate',(VOID,(BUNDLE,))),
      (WV,'<init>',(VOID,(CTX,))),(WV,'getSettings',(WS,())),
      (WS,'setJavaScriptEnabled',(VOID,(BOOL,))),(WS,'setDomStorageEnabled',(VOID,(BOOL,))),
      (WV,'loadUrl',(VOID,(STR,))),(ACT,'setContentView',(VOID,(VIEW,))),
      (C,'<init>',(VOID,())),(C,'onCreate',(VOID,(BUNDLE,)))
    ]
    descriptors={C,ACT,BUNDLE,WV,WS,CTX,VIEW,STR,VOID,BOOL}
    strings=set(descriptors)|{m[1] for m in methods}|{URL}
    def shorty(p):
        ret,pars=p
        def sh(x): return x if len(x)==1 else 'L'
        return sh(ret)+''.join(sh(x) for x in pars)
    for p in protos: strings.add(shorty(p))
    strings=sorted(strings)
    sidx={s:i for i,s in enumerate(strings)}
    types=sorted(descriptors,key=lambda d:sidx[d]); tidx={d:i for i,d in enumerate(types)}
    protos=sorted(set(protos),key=lambda p:(tidx[p[0]],tuple(tidx[x] for x in p[1])))
    pidx={p:i for i,p in enumerate(protos)}
    methods=sorted(methods,key=lambda m:(tidx[m[0]],sidx[m[1]],pidx[m[2]]))
    midx={m:i for i,m in enumerate(methods)}

    hs=0x70
    string_ids_off=hs
    type_ids_off=string_ids_off+4*len(strings)
    proto_ids_off=type_ids_off+4*len(types)
    method_ids_off=proto_ids_off+12*len(protos)
    class_defs_off=method_ids_off+8*len(methods)
    data_off=align4(class_defs_off+32)

    # Build parameter type_lists first.
    data=bytearray(); type_list_off={}
    for p in protos:
        pars=p[1]
        if not pars: continue
        while (data_off+len(data))%4: data.append(0)
        off=data_off+len(data); type_list_off[p]=off
        data += struct.pack('<I',len(pars))+b''.join(struct.pack('<H',tidx[x]) for x in pars)
        while len(data)%4: data.append(0)

    # Helpers for code units
    def inv(op, regs, mi):
        count=len(regs); Cc=regs[0] if count>0 else 0; D=regs[1] if count>1 else 0; Ee=regs[2] if count>2 else 0; F=regs[3] if count>3 else 0; G=regs[4] if count>4 else 0
        return [op|(count<<8)|(G<<12),mi,Cc|(D<<4)|(Ee<<8)|(F<<12)]
    def newinst(reg,ty): return [0x22|(reg<<8),tidx[ty]]
    def moveresobj(reg): return [0x0c|(reg<<8)]
    def const4(reg,val): return [0x12|(reg<<8)|((val&0xf)<<12)]
    def conststr(reg,s): return [0x1a|(reg<<8),sidx[s]]
    def code_item(regs,ins,outs,words):
        b=bytearray(struct.pack('<HHHHII',regs,ins,outs,0,0,len(words)))
        b += struct.pack('<%dH'%len(words),*words)
        return bytes(b)

    ctor_ref=(ACT,'<init>',(VOID,()))
    ctor_words=inv(0x70,[0],midx[ctor_ref])+[0x000e]
    oc_words=[]
    oc_words += inv(0x6f,[3,4],midx[(ACT,'onCreate',(VOID,(BUNDLE,)))])
    oc_words += newinst(0,WV)
    oc_words += inv(0x70,[0,3],midx[(WV,'<init>',(VOID,(CTX,)))])
    oc_words += inv(0x6e,[0],midx[(WV,'getSettings',(WS,()))])
    oc_words += moveresobj(1)
    oc_words += const4(2,1)
    oc_words += inv(0x6e,[1,2],midx[(WS,'setJavaScriptEnabled',(VOID,(BOOL,)))])
    oc_words += inv(0x6e,[1,2],midx[(WS,'setDomStorageEnabled',(VOID,(BOOL,)))])
    oc_words += conststr(1,URL)
    oc_words += inv(0x6e,[0,1],midx[(WV,'loadUrl',(VOID,(STR,)))])
    oc_words += inv(0x6e,[3,0],midx[(ACT,'setContentView',(VOID,(VIEW,)))])
    oc_words += [0x000e]
    codes={midx[(C,'<init>',(VOID,()))]:code_item(1,1,1,ctor_words),
           midx[(C,'onCreate',(VOID,(BUNDLE,)))]:code_item(5,2,2,oc_words)}
    code_off={}
    for mi in sorted(codes):
        while (data_off+len(data))%4: data.append(0)
        code_off[mi]=data_off+len(data); data+=codes[mi]

    # Class data, one direct constructor + one virtual onCreate.
    ctor_m=midx[(C,'<init>',(VOID,()))]; onc_m=midx[(C,'onCreate',(VOID,(BUNDLE,)))]
    cd=bytearray(); cd+=uleb(0)+uleb(0)+uleb(1)+uleb(1)
    cd+=uleb(ctor_m)+uleb(0x10001)+uleb(code_off[ctor_m])
    cd+=uleb(onc_m)+uleb(0x0004)+uleb(code_off[onc_m])
    class_data_off=data_off+len(data); data+=cd

    # String data
    string_data_off={}
    for s in strings:
        string_data_off[s]=data_off+len(data)
        # ASCII only in DEX strings used here; UTF-16 length == codepoint count.
        b=s.encode('utf-8'); data+=uleb(len(s))+b+b'\x00'

    # map_list aligned to four bytes
    while (data_off+len(data))%4: data.append(0)
    map_off=data_off+len(data)
    # map item type,size,offset
    items=[(0x0000,1,0),(0x0001,len(strings),string_ids_off),(0x0002,len(types),type_ids_off),(0x0003,len(protos),proto_ids_off),(0x0005,len(methods),method_ids_off),(0x0006,1,class_defs_off)]
    tl_offsets=list(type_list_off.values())
    if tl_offsets: items.append((0x1001,len(tl_offsets),min(tl_offsets)))
    items += [(0x2001,len(codes),min(code_off.values())),(0x2000,1,class_data_off),(0x2002,len(strings),min(string_data_off.values())),(0x1000,1,map_off)]
    items=sorted(items,key=lambda x:x[2])
    data += struct.pack('<I',len(items))
    for typ,size,off in items: data += struct.pack('<HHII',typ,0,size,off)

    file_size=data_off+len(data); data_size=file_size-data_off
    # Identifier tables
    ids=bytearray()
    ids += b''.join(struct.pack('<I',string_data_off[s]) for s in strings)
    ids += b''.join(struct.pack('<I',sidx[t]) for t in types)
    for p in protos:
        ids += struct.pack('<III',sidx[shorty(p)],tidx[p[0]],type_list_off.get(p,0))
    for c,n,p in methods:
        ids += struct.pack('<HHI',tidx[c],pidx[p],sidx[n])
    # class_def
    ids += struct.pack('<IIIIIIII',tidx[C],0x0001,tidx[ACT],0,NO_INDEX,0,class_data_off,0)
    if hs+len(ids)>data_off: raise RuntimeError('id tables exceeded planned data offset')
    ids += b'\x00'*(data_off-(hs+len(ids)))

    header=bytearray(hs)
    header[:8]=b'dex\n035\x00'
    fields=[file_size,hs,0x12345678,0,0,map_off,len(strings),string_ids_off,len(types),type_ids_off,len(protos),proto_ids_off,0,0,len(methods),method_ids_off,1,class_defs_off,data_size,data_off]
    struct.pack_into('<20I',header,32,*fields)
    dex=header+ids+data
    assert len(dex)==file_size
    dex[12:32]=hashlib.sha1(dex[32:]).digest()
    struct.pack_into('<I',dex,8,zlib.adler32(dex[12:])&0xffffffff)
    return bytes(dex), {'strings':strings,'types':types,'protos':protos,'methods':methods,'map_off':map_off,'class_data_off':class_data_off,'code_off':code_off}

# Basic structural validators independent of Android SDK
def validate_dex(dex):
    assert dex[:8]==b'dex\n035\x00'
    assert struct.unpack_from('<I',dex,32)[0]==len(dex)
    assert hashlib.sha1(dex[32:]).digest()==dex[12:32]
    assert (zlib.adler32(dex[12:])&0xffffffff)==struct.unpack_from('<I',dex,8)[0]
    assert struct.unpack_from('<I',dex,40)[0]==0x12345678

def validate_axml(x):
    typ,hs,size=struct.unpack_from('<HHI',x,0); assert typ==RES_XML_TYPE and hs==8 and size==len(x)
    off=8; seen=[]
    while off<len(x):
        t,h,s=struct.unpack_from('<HHI',x,off); assert s>=8 and off+s<=len(x); seen.append(t); off+=s
    assert RES_STRING_POOL in seen and RES_XML_START_ELEMENT in seen and RES_XML_END_ELEMENT in seen

manifest=make_manifest(); dex,meta=make_dex(); validate_axml(manifest); validate_dex(dex)
(OUT/'AndroidManifest.xml').write_bytes(manifest); (OUT/'classes.dex').write_bytes(dex)
unsigned=OUT/'TicoListo-MVP-unsigned.apk'; signed=ROOT/'TicoListo-MVP-v0.1.apk'
for f in (unsigned,signed):
    if f.exists(): f.unlink()
with zipfile.ZipFile(unsigned,'w') as z:
    z.writestr('AndroidManifest.xml',manifest,compress_type=zipfile.ZIP_DEFLATED)
    z.writestr('classes.dex',dex,compress_type=zipfile.ZIP_DEFLATED)
    z.write(ROOT/'assets'/'index.html','assets/index.html',compress_type=zipfile.ZIP_DEFLATED)

keystore=OUT/'ticolisto-test.jks'
if not keystore.exists():
    subprocess.run(['keytool','-genkeypair','-v','-keystore',str(keystore),'-storepass','ticolisto-test','-keypass','ticolisto-test','-alias','ticolisto','-keyalg','RSA','-keysize','2048','-validity','3650','-dname','CN=TicoListo MVP, OU=Testing, O=TicoListo, L=San Jose, C=CR'],check=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
shutil.copy2(unsigned,signed)
subprocess.run(['jarsigner','-keystore',str(keystore),'-storepass','ticolisto-test','-keypass','ticolisto-test','-sigalg','SHA256withRSA','-digestalg','SHA-256',str(signed),'ticolisto'],check=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
verify=subprocess.run(['jarsigner','-verify','-verbose','-certs',str(signed)],check=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True).stdout
with zipfile.ZipFile(signed) as z:
    names=z.namelist(); assert 'AndroidManifest.xml' in names and 'classes.dex' in names and 'assets/index.html' in names and any(n.startswith('META-INF/') for n in names)
sha=hashlib.sha256(signed.read_bytes()).hexdigest()
report=ROOT/'BUILD-REPORT.txt'
report.write_text(f'''TicoListo MVP v0.1\nPackage: cr.ticolisto.app\nVersion code: 1\nminSdk: 23\ntargetSdk: 29 (MVP sideload compatibility with v1 JAR/APK signature in this constrained build environment)\nAPK: {signed.name}\nSize: {signed.stat().st_size} bytes\nSHA-256: {sha}\nDEX size: {len(dex)} bytes\nManifest size: {len(manifest)} bytes\nSignature verification: PASS (jarsigner)\nNote: This is a test-signed sideload MVP, not a Google Play production build.\n''')
print(report.read_text())
