"""Validate the 0.16 RSA-signed public preview, not arbitrary Android packages.
Usage: python tools/verify-apk-16.py APK REPO_ROOT
Requires cryptography. Checks AOSP v2 signature/protected digests, matching public
preview certificate, one-byte tamper rejection, ZIP CRC, manifest and dist bytes.
This is not a replacement for platform install/SDK/phone testing.
"""
from pathlib import Path
import struct,hashlib,json,sys,zipfile
from cryptography import x509
from cryptography.hazmat.primitives import hashes,serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import pkcs12
u32=lambda b,p=0:struct.unpack_from('<I',b,p)[0]
u64=lambda b,p=0:struct.unpack_from('<Q',b,p)[0]
def lp(b,p=0):
 n=u32(b,p);assert p+4+n<=len(b);return b[p+4:p+4+n],p+4+n
def seq(b):
 p=0
 while p<len(b):v,p=lp(b,p);yield v
 assert p==len(b)
def verify_v2(b):
 # AOSP v2 format/digest algorithm, https://source.android.com/docs/security/features/apksigning/v2
 eocd=b.rfind(b'PK\x05\x06');assert eocd>=0
 assert eocd+22+struct.unpack_from('<H',b,eocd+20)[0]==len(b)
 cd=u32(b,eocd+16);assert cd+u32(b,eocd+12)==eocd
 assert b[cd-16:cd]==b'APK Sig Block 42';size=u64(b,cd-24);start=cd-size-8;assert u64(b,start)==size
 p=start+8;v2=None
 while p<cd-24:
  n=u64(b,p);assert n>=4 and p+8+n<=cd-24
  if u32(b,p+8)==0x7109871a:assert v2 is None;v2=b[p+12:p+8+n]
  p+=8+n
 assert p==cd-24 and v2 is not None
 signers,end=lp(v2);assert end==len(v2);verified=[]
 for signer in seq(signers):
  signed,p=lp(signer);sigs,p=lp(signer,p);public,p=lp(signer,p);assert p==len(signer)
  digests,p=lp(signed);certs,p=lp(signed,p);attrs,p=lp(signed,p)
  # Current AOSP V2SchemeSigner appends one empty length-prefixed field.
  assert signed[p:] in (b'',b'\x00'*4), 'Unexpected signed-data trailing bytes'
  signatures={u32(v):lp(v,4)[0] for v in seq(sigs)};digests={u32(v):lp(v,4)[0] for v in seq(digests)}
  assert list(signatures)==list(digests)
  alg=next((a for a in [0x0104,0x0102,0x0103,0x0101] if a in signatures),None);assert alg is not None,'Expected RSA preview signature'
  digest=hashes.SHA512() if alg in [0x0102,0x0104] else hashes.SHA256();hashfn=hashlib.sha512 if digest.digest_size==64 else hashlib.sha256
  key=serialization.load_der_public_key(public)
  pad=padding.PSS(mgf=padding.MGF1(digest),salt_length=digest.digest_size) if alg in [0x0101,0x0102] else padding.PKCS1v15()
  key.verify(signatures[alg],signed,pad,digest)
  cert=x509.load_der_x509_certificate(next(seq(certs)))
  assert cert.public_key().public_bytes(serialization.Encoding.DER,serialization.PublicFormat.SubjectPublicKeyInfo)==public
  tail=bytearray(b[eocd:]);struct.pack_into('<I',tail,16,start)
  chunks=[]
  for section in [b[:start],b[cd:eocd],bytes(tail)]:
   for at in range(0,len(section),2**20):
    c=section[at:at+2**20];chunks.append(hashfn(b'\xa5'+struct.pack('<I',len(c))+c).digest())
  actual=hashfn(b'\x5a'+struct.pack('<I',len(chunks))+b''.join(chunks)).digest();assert actual==digests[alg],'APK protected content digest mismatch'
  verified.append(dict(algorithm=hex(alg),certificateSha256=cert.fingerprint(hashes.SHA256()).hex()))
 assert verified;return verified

def manifest(data):
 strings=[];p=8
 def length8(at):
  n=data[at];return (((n&127)<<8)|data[at+1],at+2) if n&128 else (n,at+1)
 while p<len(data):
  kind,header,size=struct.unpack_from('<HHI',data,p);assert size>0
  if kind==1:
   count=u32(data,p+8);flags=u32(data,p+16);begin=p+u32(data,p+20)
   for i in range(count):
    at=begin+u32(data,p+header+i*4)
    if flags&256:
     _,at=length8(at);n,at=length8(at);strings.append(data[at:at+n].decode())
    else:
     n=struct.unpack_from('<H',data,at)[0];at+=2
     if n&32768:n=((n&32767)<<16)|struct.unpack_from('<H',data,at)[0];at+=2
     strings.append(data[at:at+n*2].decode('utf-16le'))
  if kind==0x102 and strings[u32(data,p+20)]=='manifest':
   start,step,count=struct.unpack_from('<HHH',data,p+24);attrs={}
   for i in range(count):
    at=p+16+start+i*step;name=strings[u32(data,at+4)];raw=u32(data,at+8);value=u32(data,at+16);typ=data[at+15]
    attrs[name]=strings[raw] if raw!=0xffffffff else strings[value] if typ==3 else value
   return attrs
  p+=size
 raise ValueError('No manifest element')

apk=Path(sys.argv[1]);repo=Path(sys.argv[2]);raw=apk.read_bytes();sigs=verify_v2(raw)
_,cert,_=pkcs12.load_key_and_certificates((repo/'android/debug-signing/public-test.p12').read_bytes(),b'android')
assert sigs[0]['certificateSha256']==cert.fingerprint(hashes.SHA256()).hex()
tampered=bytearray(raw);tampered[100]^=1
try:verify_v2(bytes(tampered))
except Exception:tamper_rejected=True
else:raise ValueError('Tampered content was accepted')
with zipfile.ZipFile(apk) as z:
 assert z.testzip() is None
 m=manifest(z.read('AndroidManifest.xml'));assert m['package']=='com.danilah.waterywatersort.preview3';assert m['versionCode']==16;assert m['versionName']=='0.16.0-feel'
 files=[]
 for p in (repo/'dist').rglob('*'):
  if p.is_file():
   relative=p.relative_to(repo/'dist').as_posix();assert z.read('assets/public/'+relative)==p.read_bytes(),relative;files.append(relative)
 assert len([p for p in files if p.endswith('.ogg')])==12
 report=dict(apk=apk.name,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),manifest=m,v2Signatures=sigs,publicPreviewCertificateMatches=True,tamperedProtectedByteRejected=tamper_rejected,distFilesMatched=files)
 print(json.dumps(report,ensure_ascii=False,indent=2))
