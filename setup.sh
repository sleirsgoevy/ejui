SERVER="$1"

wget -r "http://$SERVER:8000/.git"
cd "$SERVER:8000"
git checkout master
git stash

bash download_brutejudge.sh

cat > ../ejui.sh << EOF
#!/bin/bash

SERVER=your-server-url # for jjs: http://127.0.0.1:1779/
BIND_ADDR=127.0.0.1:8080 # or any other port

cd "\$(dirname "\$0")/$SERVER:8000"
python3 ejui.py "\$BIND_ADDR" "\$SERVER"
EOF

echo "ejui installed, see ejui.sh for how to launch."
