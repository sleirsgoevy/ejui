import ejui, sys, os.path

if len(sys.argv) != 3:
    sys.stderr.write("""\
usage: ejui.py <bind_addr> <tgt_addr>
Environment variables:
* EJUI_PRELOAD
    `pathsep`-separated list of modules to be imported before ejui starts.
""")
    exit(1)
if 'EJUI_PRELOAD' in os.environ:
    for i in os.environ['EJUI_PRELOAD'].split(os.path.pathsep):
        __import__(i)
host, port = sys.argv[1].rsplit(':', 1)
if host.startswith('[') and host.endswith(']'): host = host[1:-1]
port = int(port)
tgt_addr = sys.argv[2]
ejui.main((host, port), tgt_addr)
