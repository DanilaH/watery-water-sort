"""Black-box smoke of the installed, signed APK on the Pixel 6 CI emulator."""
import subprocess,time,re,xml.etree.ElementTree as ET
from pathlib import Path

OUT=Path('device-smoke');OUT.mkdir(exist_ok=True)
PKG='com.danilah.waterywatersort'
def adb(*args):
    return subprocess.check_output(['adb',*args],text=True,stderr=subprocess.STDOUT)
def ui():
    for attempt in range(4):
        try:
            adb('shell','uiautomator','dump','/sdcard/smoke.xml')
            return ET.fromstring(adb('shell','cat','/sdcard/smoke.xml'))
        except (subprocess.CalledProcessError, ET.ParseError) as error:
            print('Accessibility tree not ready:', getattr(error, 'output', str(error)), flush=True)
            if attempt == 3:
                raise
            time.sleep(2)
def click(label):
    deadline=time.monotonic()+25
    while time.monotonic()<deadline:
        tree=ui()
        matches=[n for n in tree.iter('node') if n.get('text')==label or n.get('content-desc')==label]
        for n in matches:
            nums=list(map(int,re.findall(r'\d+',n.get('bounds',''))))
            if len(nums)==4 and nums[2]>nums[0] and nums[3]>nums[1] and n.get('enabled')=='true' and n.get('clickable')=='true':
                adb('shell','input','tap',str((nums[0]+nums[2])//2),str((nums[1]+nums[3])//2))
                time.sleep(2)
                return
        time.sleep(.5)
    raise AssertionError('Missing control: '+label)
def shot(name):
    time.sleep(2)
    with (OUT/(name+'.png')).open('wb') as f:
        subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
    (OUT/(name+'.xml')).write_text(ET.tostring(ui(),encoding='unicode'))
def expect(label):
    tree=ui()
    assert any(label in (n.get('text','')+' '+n.get('content-desc','')) for n in tree.iter('node')),label

adb('shell','am','force-stop',PKG)
adb('logcat','-c')
adb('shell','am','start','-W','-n',PKG+'/.MainActivity')
time.sleep(4)
shot('01-home')
click('Играть')
expect('Уровень 1')
shot('02-level-1')
# Real touchscreen input unlocks the audio context and runs the native haptic path.
size=adb('shell','wm','size')
assert '1080x2400' in size,size
def pour(a,b):
    for tube in (a,b):
        adb('shell','input','tap',str([177,422,664,907][tube]),'1100')
        time.sleep(.25)
    time.sleep(3)
pour(0,2)
shot('03-first-pour')
pour(1,0)
pour(1,2)
expect('Дальше')
shot('04-victory')
click('Дальше →')
expect('Уровень 2')
shot('05-level-2')
click('Настройки')
shot('06-pause')
click('Настройки')
expect('Звуки')
shot('07-preferences')
# Close preferences to pause, then resume through real screen controls.
click('Назад')
click('Продолжить')
adb('shell','input','keyevent','KEYCODE_HOME')
time.sleep(1)
adb('shell','am','start','-W','-n',PKG+'/.MainActivity')
time.sleep(2)
expect('Уровень 2')
shot('08-returned')
adb('shell','am','force-stop',PKG)
adb('shell','am','start','-W','-n',PKG+'/.MainActivity')
time.sleep(3)
click('Продолжить')
expect('Уровень 2')
shot('09-restored')
crashes=adb('logcat','-d','-s','AndroidRuntime:E')
(OUT/'crashes.txt').write_text(crashes)
assert 'FATAL EXCEPTION' not in crashes,crashes
(OUT/'result.txt').write_text('PASS: cold start, real pours, victory, next level, pause, preferences, background/resume, force-stop/save restoration\n')
print('DEVICE SMOKE PASSED')
