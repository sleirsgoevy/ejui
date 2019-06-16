# ejui
GUI for brutejudge (including jjs)

## Installation with wget

Start an HTTP server at :8000 in the repository root.
On the target machine, run:
`wget http://<src>:8000/setup.sh
bash setup.sh <src>`
Where src is the HTTP server's IP address.

After that, fill in ejui.sh launch script with the required values.

## Local installation

No local installation is necessary.
However, ejui requires brutejudge to function. To download it, run `bash download_brutejudge.sh`.
Alternatively, you can fetch brutejudge from GitHub:

`git clone https://github.com/sleirsgoevy/brutejudge bj; ln -s bj/brutejudge brutejudge`

To run ejui, run the following command:

`python3 ejui.py <bind_addr>:<bind_port> <remote_testsys_addr>`
