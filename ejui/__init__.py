import brutejudge.http as bj, os, sys, socket, html, json, pkgutil, bottle
from brutejudge.error import BruteError
from bottle import abort, request, response, redirect, run, static_file

application = bottle.Bottle()

sessions = {}

def get_session():
    sess_id = request.get_cookie('credentials', 'invalid')
    return sessions.get(sess_id, None)

@application.route('/')
def main_page():
    if get_session() == None:
        response.set_header('Content-Type', 'text/html; charset=utf-8')
        return pkgutil.get_data('ejui', 'login.html')
    return format_page('main', pkgutil.get_data('ejui', 'main.html').decode('utf-8'))

@application.route('/style.css')
def style_css():
    response.set_header('Content-Type', 'text/css; charset=utf-8')
    return pkgutil.get_data('ejui', 'style.css')

@application.route('/app.js')
def app_js():
    response.set_header('Content-Type', 'application/javascript; charset=utf-8')
    return pkgutil.get_data('ejui', 'app.js')

@application.route('/logout.png')
def logout_png():
    response.set_header('Content-Type', 'image/png')
    return pkgutil.get_data('ejui', 'logout.png')

@application.post('/')
def do_login():
    login = request.forms.get('login', default=None)
    pass_ = request.forms.get('pass', default=None)
    if login == None or pass_ == None:
        return redirect('/')
    message = None
    try: url, cookie = bj.login(tgt_addr, login, pass_)
    except (BruteError, socket.error) as e:
        message = str(e)
    except Exception:
        raise
        message = "Internal server error"
    if message != None:
        return pkgutil.get_data('ejui', 'error.html').decode('utf-8').format(message=html.escape(message))
    session_id = os.urandom(16).hex()
    sessions[session_id] = (url, cookie)
    response.set_cookie('credentials', session_id)
    return redirect('/')

def force_session():
    s = get_session()
    if s == None:
        redirect('/')
    return s

@application.route('/api/task/<task:int>')
def task_data(task, tl=None):
    task = int(task)
    url, cookie = force_session()
    with bj.may_cache(url, cookie):
        if tl == None: tl = bj.task_list(url, cookie)
        if task not in range(len(tl)):
            abort(404)
        name = tl[task]
        tids = bj.task_ids(url, cookie)
        try: tid = tids[task]
        except IndexError: compilers = []
        else:
            try: compilers = bj.compiler_list(url, cookie, tid)
            except BruteError: compilers = []
        return {'name': name, 'compilers': compilers}

@application.route('/task/<task:int>')
def task_page(task):
    task = int(task)
    url, cookie = force_session()
    with bj.may_cache(url, cookie):
        tl = bj.task_list(url, cookie)
        td = task_data(task, tl=tl)
        t1 = pkgutil.get_data('ejui', 'task.html').decode('utf-8')
        t2 = pkgutil.get_data('ejui', 'compiler.html').decode('utf-8')
        subms, any_subms, json_subms = format_submissions(td['name'])
        if any_subms:
            subms = pkgutil.get_data('ejui', 'task_subms.html').decode('utf-8').format(subms=subms)
        else:
            subms = ''
        compilers = ''
        for a, b, c in td['compilers']:
            compilers += t2.format(id=a, short_name=html.escape(b), long_name=html.escape(c))
        if td['compilers']:
            compilers = pkgutil.get_data('ejui', 'compilers.html').decode('utf-8').format(data=compilers)
        return format_page('task%d'%task, t1.format(id=task, name=html.escape(td['name']), subms=subms, compilers=compilers), tl=tl, subms=json_subms)

@application.post('/submit/<task:int>')
@application.post('/submit/<task:int>/<cmpl:int>')
def submit(task, cmpl=None):
    url, cookie = force_session()
    js = False
    if cmpl != None:
        js = True
        cmpl = int(cmpl)
        data = request.body.read()
    else:
        cmpl = int(request.forms.get('cmpl', '0'))
        file = request.files.get('file')
        if file == None:
            return format_page('error', pkgutil.get_data('ejui', 'no_file.html'))
        data = file.file.read()
    bj.submit(url, cookie, task, cmpl, data)
    if not js:
        return redirect('/task/%d'%task)

@application.route('/submissions')
def submissions():
    subms, any_subms, json_subms = format_submissions(None)
    if any_subms:
        subms = pkgutil.get_data('ejui', 'subms.html').decode('utf-8').format(subms=subms)
    else:
        subms = pkgutil.get_data('ejui', 'no_subms.html').decode('utf-8')
    return format_page('subms', subms, subms=json_subms)

@application.route('/api/submissions/<id:int>')
def format_protocol(id):
    id = int(id)
    url, cookie = force_session()
    with bj.may_cache(url, cookie):
        tests, any_tests = format_tests(id)
        if not any_tests:
            tests = ''
        try: err = bj.compile_error(url, cookie, id)
        except:
            import traceback
            err = traceback.format_exc()
    if not err:
        err = ''
    else:
        err = pkgutil.get_data('ejui', 'compile_error.html').decode('utf-8').format(err=html.escape(err))
    return pkgutil.get_data('ejui', 'protocol.html').decode('utf-8').format(id=id, err=err, tests=tests)

@application.route('/submissions/<id:int>')
def protocol(id):
    return format_page('protocol', format_protocol(id))

@application.route('/api/submission_list')
def submission_list():
    url, cookie = force_session()
    return {"list": bj.submission_list(url, cookie)}

@application.route('/api/submission_list/<id:int>')
def submission_list_item(id):
    id = int(id)
    url, cookie = force_session()
    score = bj.submission_score(url, cookie, id)
    status = bj.submission_status(url, cookie, id)
    data = {'status': status}
    if score != None:
        data['score'] = score
    return data

@application.route('/api/stats/<id>')
def submission_stats(id):
    id = int(id)
    url, cookie = force_session()
    return bj.submission_stats(url, cookie, id)[0]

@application.route('/logout')
def logout():
    sess_id = request.get_cookie('credentials', 'invalid')
    try: del sessions[sess_id]
    except KeyError: pass
    return redirect('/')

def format_page(page, text, tl=None, subms=None):
    url, cookie = force_session()
    if tl == None: tl = bj.task_list(url, cookie)
    if subms == None: subms = format_submissions(None)[2]
    data = [('main', '/', '<b>ejui</b>')]
    for i, j in enumerate(tl):
        data.append(('task%d'%i, '/task/%d'%i, html.escape(j)))
    data2 = [('error', '', '<div id="error_btn">!</div>'), ('subms', '/submissions', 'Submissions'), ('logout', '/logout', '<img src="/logout.png" alt="Log out" />')]
    head = ''
    for a, b, c in data:
        head += '<a id="'+a+'" href="'+b+'" onclick="ajax_load(this); return false"'
        if a == page:
            head += ' class=selected'
        head += '>'+c+'</a>'
    head += '</td><td align=right>'
    for a, b, c in data2:
        head += '<a id="'+a+'" href="'+b+'" onclick="ajax_load(this); return false"'
        if a == page:
            head += ' class=selected'
        head += '>'+c+'</a>'
    head += ''
    if page.startswith('task'):
        curr_task = repr(tl[int(page[4:])])
    else:
        curr_task = 'null'
    return pkgutil.get_data('ejui', 'skel.html').decode('utf-8').format(task=curr_task, subm_preload=json.dumps(subms), head=head, body=text)

def format_submissions(task=None):
    url, cookie = force_session()
    json_data = {}
    with bj.may_cache(url, cookie):
        a, b = bj.submission_list(url, cookie)
        json_data['list'] = [a, b]
        ans = ''
        have_score = False
        status_arr = []
        stats_arr = []
        for i, t in zip(a, b):
            status = bj.submission_status(url, cookie, i)
            stats = bj.submission_score(url, cookie, i)
            status_arr.append(status)
            if stats != None and task in (t, None): have_score = True
            stats_arr.append(stats)
        tt = pkgutil.get_data('ejui', 'subm.html' if have_score else 'subm_no_score.html').decode('utf-8')
        status_arr = iter(status_arr)
        stats_arr = iter(stats_arr)
        any_subms = False
        for i, t in zip(a, b):
            status = next(status_arr)
            stats = next(stats_arr)
            json_item = {'status': status}
            if stats != None: json_item['score'] = stats
            else: stats = ''
            json_data[i] = json_item
            if task in (t, None):
                any_subms = True
                ans += tt.format(id=i, task=html.escape(t), status=html.escape(status), score=stats)
        return (pkgutil.get_data('ejui', 'subms_t.html' if have_score else 'subms_no_score.html').decode('utf-8').format(data=ans), any_subms, json_data)

def format_tests(id):
    url, cookie = force_session()
    a, b = bj.submission_results(url, cookie, id)
    data = ''
    t = pkgutil.get_data('ejui', 'test.html').decode('utf-8')
    for i, (j, k) in enumerate(zip(a, b)):
        data += t.format(id=i+1, status=j, time=k)
        return (pkgutil.get_data('ejui', 'tests.html').decode('utf-8').format(data=data), a)

import wsgiref.simple_server, socketserver

class Server(socketserver.ThreadingMixIn, wsgiref.simple_server.WSGIServer): pass

def main(bind_addr, tgt_addr_arg):
    global tgt_addr
    tgt_addr = tgt_addr_arg
    host, port = bind_addr
    run(host=host, port=port, server_class=Server, app=application)
