#!/usr/bin/python3
"""Private-loopback teaching services; never a public DNS or WHOIS substitute.

The trusted worker starts this inside each job's private network namespace.
Only student.lab is defined. No upstream lookup or external connection occurs.
"""
import selectors
import socket
import struct
from pathlib import Path
import sys
import time


def dns_reply(packet):
    if len(packet)<12 or struct.unpack('!H',packet[4:6])[0]!=1:return b''
    cursor=12;labels=[]
    while cursor<len(packet):
        length=packet[cursor];cursor+=1
        if length==0:break
        if length>63 or cursor+length>len(packet):return b''
        labels.append(packet[cursor:cursor+length].decode('ascii','replace').lower());cursor+=length
    if cursor+4>len(packet):return b''
    question=packet[12:cursor+4];kind,cls=struct.unpack('!HH',packet[cursor:cursor+4])
    known='.'.join(labels)=='student.lab' and cls==1
    data=socket.inet_aton('127.0.0.2') if kind==1 else socket.inet_pton(socket.AF_INET6,'::1') if kind==28 else b''
    answer=b'\xc0\x0c'+struct.pack('!HHIH',kind,1,60,len(data))+data if known and data else b''
    return packet[:2]+struct.pack('!HHHHH',0x8180 if known else 0x8183,1,bool(answer),0,0)+question+answer


def serve(ready):
    selector=selectors.DefaultSelector()
    dns=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);dns.bind(('127.0.0.1',5353));dns.setblocking(False)
    whois=socket.socket();whois.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
    whois.bind(('127.0.0.1',4343));whois.listen(4);whois.setblocking(False)
    selector.register(dns,selectors.EVENT_READ,'dns');selector.register(whois,selectors.EVENT_READ,'whois')
    Path(ready).touch();deadline=time.monotonic()+65
    try:
        while time.monotonic()<deadline:
            for key,_ in selector.select(.2):
                if key.data=='dns':
                    packet,address=dns.recvfrom(512);response=dns_reply(packet)
                    if response:dns.sendto(response,address)
                else:
                    client,_=whois.accept();client.settimeout(1)
                    with client:
                        try:query=client.recv(256).decode('ascii','replace').strip().lower()
                        except TimeoutError:continue
                        client.sendall(b'Local teaching fixture - not a public registry\r\n'+(
                            b'Domain Name: STUDENT.LAB\r\nRegistrar: Private Unix Lab\r\nStatus: local fixture\r\n'
                            if query=='student.lab' else b'No local record found\r\n'))
    finally:selector.close();dns.close();whois.close()


if __name__=='__main__':serve(sys.argv[1])
