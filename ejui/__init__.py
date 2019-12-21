import brutejudge.http as bj, os, sys, socket, html, json, pkgutil, bottle
from brutejudge.error import BruteError
from brutejudge.commands.scoreboard import format_single as sb_format_single
from brutejudge.commands.googlelogin import get_auth_token as goauth_get_auth_token
from bottle import abort, request, response, redirect, run, static_file
from urllib.parse import urlencode

GOAUTH_CLIENT_ID = '894979903815-c44atlfg22sp08rc1ifnfod0lej4jr0j.apps.googleusercontent.com'
GOAUTH_CLIENT_SECRET = 'Oe8J0rddJ1r70R5Jj_3_d018'

application = bottle.Bottle()

sessions = {}

def get_session():
    sess_id = request.get_cookie('credentials', 'invalid')
    return sessions.get(sess_id, None)

@application.route('/')
def main_page():
    if get_session() == None:
        login_type = bj.login_type(tgt_addr)
        goauth = [i for i in login_type if i.startswith('goauth:')]
        if goauth:
            assert len(goauth) == 1
            return redirect('https://accounts.google.com/o/oauth2/auth?'+urlencode({'redirect_uri': goauth_get_redirect_uri(), 'scope': goauth[0][7:], 'response_type': 'code', 'client_id': GOAUTH_CLIENT_ID}))
        if not login_type: return do_login()
        login_page = pkgutil.get_data('ejui', 'login.html').decode('utf-8')
        login_field = pkgutil.get_data('ejui', 'login_field.html').decode('utf-8')
        fields = ''
        if 'login' in login_type:
            fields += login_field.format(name='login', label='Login: ', type='text')
        if 'pass' in login_type:
            fields += login_field.format(name='pass', label='Password: ', type='password')
        return login_page.format(fields=fields)
    return format_page('main', pkgutil.get_data('ejui', 'main.html').decode('utf-8'))

@application.route('/style.css')
def style_css():
    response.set_header('Content-Type', 'text/css; charset=utf-8')
    return pkgutil.get_data('ejui', 'style.css')

@application.route('/table.js')
def app_js():
    response.set_header('Content-Type', 'application/javascript; charset=utf-8')
    return pkgutil.get_data('ejui', 'table.js')

@application.route('/app.js')
def app_js():
    response.set_header('Content-Type', 'application/javascript; charset=utf-8')
    return pkgutil.get_data('ejui', 'app.js')

@application.route('/<icon>.png')
def logout_png(icon):
    response.set_header('Content-Type', 'image/png')
    try: return pkgutil.get_data('ejui', icon+'.png')
    except OSError: error(404)

@application.post('/')
def do_login(get_token=None, *args):
    if get_token == None:
        login = request.forms.get('login', default=None)
        if login != None: login = login.encode('latin-1').decode('utf-8', 'replace')
        pass_ = request.forms.get('pass', default=None)
        if pass_ != None: pass_ = pass_.encode('latin-1').decode('utf-8', 'replace')
    else: login = pass_ = None
    message = None
    try: url, cookie = bj.login(tgt_addr, login, pass_, **({'token': get_token(*args)} if get_token != None else {}))
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

def goauth_get_redirect_uri():
    return request.urlparts[0]+'://'+request.urlparts[1]+'/goauth'

@application.get('/goauth')
def goauth_redirect():
    login_code = request.query.get('code')
    redirect_uri = goauth_get_redirect_uri()
    print(login_code, redirect_uri)
    return do_login(goauth_get_auth_token, login_code, redirect_uri, GOAUTH_CLIENT_ID, GOAUTH_CLIENT_SECRET)

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

@application.route('/api/scoreboard')
def format_scoreboard(aug=lambda y, x: x):
    url, cookie = force_session()
    with bj.may_cache(url, cookie):
        try: data = bj.scoreboard(url, cookie)
        except BruteError as e:
            bottle.response.status = 500
            return aug(True, '<pre>'+html.escape(str(e))+'</pre>')
        except:
            bottle.response.status = 500
            return aug(True, '<pre>Internal server error</pre>')
        tasks = bj.task_list(url, cookie)
    task = pkgutil.get_data('ejui', 'scoreboard_task.html').decode('utf-8')
    tasks = ''.join(task.format(name=html.escape(i)) for i in tasks)
    contestant = pkgutil.get_data('ejui', 'contestant.html').decode('utf-8')
    contestant_task = pkgutil.get_data('ejui', 'contestant_task.html').decode('utf-8')
    contestants = []
    for index, (data, scores) in enumerate(data):
        cur_tasks = ''.join('<td></td>' if i == None else contestant_task.format(kind=(('ok' if i['attempts'] >= 0 else 'fail') if 'attempts' in i else 'unknown'), score=sb_format_single(i)) for i in scores)
        contestants.append(contestant.format(index=index+1, nickname=data['name'], tasks=cur_tasks))
    return aug(False, pkgutil.get_data('ejui', 'scoreboard.html').decode('utf-8').format(tasks=tasks, contestants=''.join(contestants)))

@application.route('/scoreboard')
def scoreboard():
    err, ans = format_scoreboard(aug=lambda *args: args)
    return format_page('error' if err else 'scoreboard', ans)

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

@application.route('/api/stats/<id:int>')
def submission_stats(id):
    id = int(id)
    url, cookie = force_session()
    return bj.submission_stats(url, cookie, id)[0]

@application.route('/clars')
def clar_list():
    url, cookie = force_session()
    t1 = pkgutil.get_data('ejui', 'clar.html').decode('utf-8')
    clars = ''
    clar_list = list(zip(*bj.clars(url, cookie)))
    for i, n in clar_list:
        clars += t1.format(id=i, title=html.escape(n))
    if clars: clars = pkgutil.get_data('ejui', 'clars_table.html').decode('utf-8').format(clars=clars)
    else: clars = pkgutil.get_data('ejui', 'no_clars.html').decode('utf-8')
    return format_page('clars', pkgutil.get_data('ejui', 'clars.html').decode('utf-8').format(clars=clars), clars=clar_list)

@application.route('/api/clars/<id:int>')
def api_clar_view(id, clar_list=None):
    id = int(id)
    url, cookie = force_session()
    if clar_list == None: clar_list = list(zip(*bj.clars(url, cookie)))
    for i, n in clar_list:
        if i == id: break
    else: abort(404)
    title = n
    text = bj.read_clar(url, cookie, i)
    return pkgutil.get_data('ejui', 'clar_view.html').decode('utf-8').format(id=id, title=title, text=text)

@application.route('/clars/<id:int>')
def clar_view(id):
    id = int(id)
    url, cookie = force_session()
    clar_list = list(zip(*bj.clars(url, cookie)))
    return format_page('clars', api_clar_view(id, clar_list), clars=clar_list)

@application.route('/clars/submit/<task:int>')
def clar_form(task):
    task = int(task)
    url, cookie = force_session()
    tl = bj.task_list(url, cookie)
    if task not in range(len(tl)):
        abort(404)
    name = tl[task]
    return format_page('clars', pkgutil.get_data('ejui', 'submit_clar.html').decode('utf-8').format(id=task, name=html.escape(name)))

@application.post('/clars/submit/<task:int>')
def submit_clar(task):
    task = int(task)
    title = bottle.request.forms.get('title', '').encode('latin-1').decode('utf-8', 'replace')
    text = bottle.request.forms.get('text', '').encode('latin-1').decode('utf-8', 'replace')
    if not title or not text:
        return format_page('error', pkgutil.get_data('ejui', 'malformed_clar.html').decode('utf-8'))
    url, cookie = force_session()
    tl = bj.task_ids(url, cookie)
    if task not in range(len(tl)):
        abort(404)
    bj.submit_clar(url, cookie, tl[task], title, text)
    bottle.redirect('/clars')

@application.route('/logout')
def logout():
    sess_id = request.get_cookie('credentials', 'invalid')
    try: del sessions[sess_id]
    except KeyError: pass
    return redirect('/')

def format_page(page, text, tl=None, subms=None, clars=None):
    url, cookie = force_session()
    if tl == None: tl = bj.task_list(url, cookie)
    if clars == None: clars = list(zip(*bj.clars(url, cookie)))
    if subms == None: subms = format_submissions(None)[2]
    data = [('main', '', '/', '<b>ejui</b>')]
    for i, j in enumerate(tl):
        data.append(('task%d'%i, '', '/task/%d'%i, html.escape(j)))
    data2 = [('error', '', '', '<div id="error_btn">!</div>'), ('subms', '', '/submissions', 'Submissions'), ('scoreboard', '', '/scoreboard', 'Scoreboard'), ('logout', 'toolbar_icon', '/logout', '<img src="/logout.png" alt="Log out" />')]
    if clars or page == 'clars': data2.insert(3, ('clars', 'toolbar_icon', '/clars', '<img src="/mail.png" alt="Clarifications" />'))
    head = ''
    for a, b, c, d in data:
        if a == page:
            b += ' selected'
        head += '<a id="'+a+'" class="'+b+'" href="'+c+'" onclick="ajax_load(this); return false"'
        head += '>'+d+'</a>'
    head += '</td><td align=right>'
    for a, b, c, d in data2:
        head += '<a id="'+a+'" class="'+b+'" href="'+c+'" onclick="ajax_load(this); return false"'
        if a == page:
            head += ' class=selected'
        head += '>'+d+'</a>'
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
