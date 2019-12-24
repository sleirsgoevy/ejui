FROM ubuntu:bionic
RUN apt-get update -y && apt-get install -y wget unzip python3 python3-pip
COPY . ~/ej-src
WORKDIR ~/ej-src
RUN  bash ./download_brutejudge.sh
RUN pip3 install bottle
ENTRYPOINT python3 -m ejui