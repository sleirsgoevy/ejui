import http.server, tarfile, gzip, io

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            data = open('web-setup.sh', 'rb').read()
        elif self.path == '/ejui.tar.gz':
            i = io.BytesIO()
            j = gzip.GzipFile('ejui.tar.gz', 'w', fileobj=i)
            k = tarfile.TarFile('ejui.tar', 'w', fileobj=j)
            k.add('.', 'ejui')
            k.close()
            j.close()
            data = i.getvalue()
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

http.server.HTTPServer(('127.0.0.1', 8000), Handler).serve_forever()
