"""Inspect built manifests and real JVM results. No emulator/live SDK claim."""
import json,re,xml.etree.ElementTree as E
from pathlib import Path
root=Path('android/app/build');ns='{http://schemas.android.com/apk/res/android}'
def manifest(variant):
 paths=[p for p in root.rglob('AndroidManifest.xml') if variant in p.parts and any(x in p.parts for x in ['merged_manifest','merged_manifests'])]
 assert paths,variant
 p=sorted(paths,key=lambda p:len(str(p)))[0];r=E.parse(p).getroot();app=r.find('application')
 return {'package':r.get('package'),'application':app.get(ns+'name'),'debuggable':app.get(ns+'debuggable','false'),'permissions':sorted({n.get(ns+'name') for n in r.findall('uses-permission')})}
debug,release=manifest('debug'),manifest('release');assert debug['package']=='com.danilah.waterywatersort.preview3' and release['package']=='com.danilah.waterywatersort';assert debug['debuggable']=='true' and release['debuggable']=='false';assert release['application']=='com.danilah.waterywatersort.WaterApplication'
configs=list((root/'generated/source/buildConfig/debug').rglob('BuildConfig.java'));assert len(configs)==1;s=configs[0].read_text();assert re.search(r'ANALYTICS_API_KEY\s*=\s*""',s) and 'demo-rewarded-yandex' in s
results=[E.parse(p).getroot()for p in (root/'test-results/testDebugUnitTest').glob('TEST-*.xml')];assert results
jvm={k:sum(int(r.get(k,'0'))for r in results)for k in ['tests','failures','errors','skipped']};assert jvm['tests']>=8 and jvm['failures']==0 and jvm['errors']==0
assert 'Production IDs are required' in Path('android/qa-release-guard.log').read_text();assert 'Production signing is required' in Path('android/qa-signing-guard.log').read_text()
assert 'Preview signing keys are forbidden' in Path('android/qa-preview-key-guard.log').read_text()
assert not list((root/'outputs/apk/release').glob('*.apk'))
report={'debug':debug,'release':release,'previewCustomAnalyticsEnabled':False,'previewRewardedUsesDemo':True,'jvm':jvm,'missingIDsRejected':True,'missingProductionSigningRejected':True,'publicPreviewKeyRejectedEvenOnDirectPackageTask':True,'productionPackageCreated':False,'physicalDeviceTested':False,'liveRewardedTested':False}
Path('android/qa-release.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
