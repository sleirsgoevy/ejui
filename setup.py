import setuptools

def get_version():
    import os
    try:
        if os.path.isfile('.git/HEAD'):
            with open('.git/HEAD') as file:
                ref = [i for i in file if i.startswith('ref: ')][0][5:].strip()
            if os.path.isfile('.git/'+ref):
               with open('.git/'+ref) as file:
                   return 'git-%s' % file.read(6)
    except: pass
    return 'unknown'

setuptools.setup(
    name = 'ejui',
    version = get_version(),
    packages = setuptools.find_packages(),
    install_requires = ['ejcli', 'bottle'],
    dependency_links = ['git+https://github.com/sleirsgoevy/brutejudge.git'],
    entry_points = {
        'console_scripts': ['ejui = ejui.__main__:_']
    },
    package_data = {'ejui': ['*.html', '*.css', '*.js', '*.png']}
)
