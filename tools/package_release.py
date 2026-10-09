import os, sys, zipfile, hashlib, shutil

# Builds the two artifacts a release publishes: the deployable web app and the
# Android test build, plus a checksum file.
#   python tools/package_release.py v1.0.0
# Requires the APK to have been built already (see mobile/README.md).
VERSION = sys.argv[1] if len(sys.argv) > 1 else 'v0.0.0'
STAMP = (2026, 10, 9, 0, 0, 0)

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app = os.path.join(root, 'app')
dist = os.path.join(root, 'dist')
os.makedirs(dist, exist_ok=True)
out = os.path.join(dist, 'dopa-drill-%s-web.zip' % VERSION)

files = []
for dirpath, dirnames, filenames in os.walk(app):
    dirnames.sort()
    for fn in sorted(filenames):
        p = os.path.join(dirpath, fn)
        files.append((p, os.path.relpath(p, app).replace(os.sep, '/')))

# Deterministic archive: sorted entries and a fixed timestamp, so the same tree
# always produces the same zip and the published checksum means something.
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for p, rel in files:
        info = zipfile.ZipInfo(rel, date_time=STAMP)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        with open(p, 'rb') as fh:
            z.writestr(info, fh.read())

print('zip: %d files, %d KiB' % (len(files), os.path.getsize(out) / 1024))

apk_src = os.path.join(root, 'mobile', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
apk_dst = os.path.join(dist, 'dopa-drill-%s-android-debug.apk' % VERSION)
if not os.path.exists(apk_src):
    sys.exit('APK not found at %s - build it first (see mobile/README.md)' % apk_src)
shutil.copy2(apk_src, apk_dst)
print('apk: %.1f MB' % (os.path.getsize(apk_dst) / 1048576))

lines = []
for f in sorted(os.listdir(dist)):
    if f.endswith('.zip') or f.endswith('.apk'):
        with open(os.path.join(dist, f), 'rb') as fh:
            h = hashlib.sha256(fh.read()).hexdigest()
        lines.append('%s  %s' % (h, f))
        print('%s...  %s' % (h[:16], f))
with open(os.path.join(dist, 'SHA256SUMS.txt'), 'w', newline='\n') as fh:
    fh.write('\n'.join(lines) + '\n')
print('SHA256SUMS.txt written')

