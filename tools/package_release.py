import os, sys, zipfile, hashlib, shutil

# Builds the two artifacts a release publishes: the deployable web app and the
# Android test build, plus a checksum file.
#   python tools/package_release.py v1.0.0
#
# The APK is not built here - do that first with `npm run apk` in mobile/ - but
# it IS verified against app/ before packaging. The Android project holds a
# generated copy of the web files, refreshed by `cap copy`, so a build without
# that step silently ships the previous release's files inside a current APK.
# That happened once; the check below is what stops it happening again.
VERSION = sys.argv[1] if len(sys.argv) > 1 else 'v0.0.0'
STAMP = (2026, 10, 10, 0, 0, 0)

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app = os.path.join(root, 'app')
dist = os.path.join(root, 'dist')
os.makedirs(dist, exist_ok=True)
out = os.path.join(dist, 'dopa-drill-%s-web.zip' % VERSION)


def web_files(base):
    """Every file under `base`, keyed by its slash-separated relative path."""
    found = {}
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames.sort()
        for fn in sorted(filenames):
            p = os.path.join(dirpath, fn)
            rel = os.path.relpath(p, base).replace(os.sep, '/')
            with open(p, 'rb') as fh:
                found[rel] = fh.read()
    return found


files = web_files(app)

# Deterministic archive: sorted entries and a pinned timestamp, so re-running
# this script for the same release reproduces the same file and the published
# checksum keeps meaning something. Bump STAMP when starting a new release.
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for rel in sorted(files):
        info = zipfile.ZipInfo(rel, date_time=STAMP)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        z.writestr(info, files[rel])

print('zip:  %d files, %d KiB' % (len(files), os.path.getsize(out) / 1024))

apk_src = os.path.join(root, 'mobile', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
apk_dst = os.path.join(dist, 'dopa-drill-%s-android-debug.apk' % VERSION)
if not os.path.exists(apk_src):
    sys.exit('APK not found at %s\n  build it first:  cd mobile && npm run apk' % apk_src)

# Every web file the APK carries must be byte-identical to app/. A mismatch
# means the Android project is holding a stale copy.
with zipfile.ZipFile(apk_src) as z:
    apk_names = set(z.namelist())
    stale, missing = [], []
    for rel, data in sorted(files.items()):
        entry = 'assets/public/' + rel
        if entry not in apk_names:
            missing.append(rel)
        elif z.read(entry) != data:
            stale.append(rel)

if missing or stale:
    sys.exit(
        'refusing to package a stale APK\n'
        + ('  missing: %s\n' % ', '.join(missing) if missing else '')
        + ('  out of date: %s\n' % ', '.join(stale) if stale else '')
        + '  the Android project copies app/ via `cap copy`; rebuild with:\n'
        + '    cd mobile && npm run apk',
    )
print('apk:  %d web files verified byte-identical to app/' % len(files))

shutil.copy2(apk_src, apk_dst)
print('apk:  %.1f MB' % (os.path.getsize(apk_dst) / 1048576))

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


