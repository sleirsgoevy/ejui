SERVER="$1"

wget "http://$1:8000/ejui.tar.gz" -O - | tar -xvzf -
cd ejui
bash download_brutejudge.sh
cd ..

sudo pip3 install bottle

cat > ejui.sh << EOF
#!/bin/bash

SERVER=your-server-url # for jjs: http://127.0.0.1:1779/
BIND_ADDR=127.0.0.1:8080 # or any other port

cd "\$(dirname "\$0")/ejui"
python3 ejui.py "\$BIND_ADDR" "\$SERVER"
EOF

echo "ejui installed, see ejui.sh for how to launch."
