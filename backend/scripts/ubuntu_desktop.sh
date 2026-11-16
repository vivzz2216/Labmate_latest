#!/bin/bash
# Real GNOME on a virtual X display; no HTML desktop imitation.
set -eu
export HOME=/home/labmate USER=labmate LOGNAME=labmate DISPLAY=:1
cd "$HOME"
export XDG_RUNTIME_DIR=/run/user/$(id -u)
mkdir -p "$XDG_RUNTIME_DIR" "$HOME/.vnc"
chmod 700 "$XDG_RUNTIME_DIR"
mkdir -p "$HOME/.config/gtk-4.0" "$HOME/.local/share/org.gnome.Ptyxis/palettes"
install -m 644 /opt/labmate/ubuntu_capture.css "$HOME/.config/gtk-4.0/gtk.css"
install -m 644 /opt/labmate/ubuntu_reference.palette "$HOME/.local/share/org.gnome.Ptyxis/palettes/labmate-ubuntu.palette"
mkdir -p "$HOME/.local/share/icons/LabMateUbuntu/scalable/actions"
cp /usr/share/icons/Yaru/scalable/status/dialog-information-symbolic.svg "$HOME/.local/share/icons/LabMateUbuntu/scalable/actions/document-properties-symbolic.svg"
cat > "$HOME/.local/share/icons/LabMateUbuntu/index.theme" <<'THEME'
[Icon Theme]
Name=LabMate Ubuntu
Inherits=Yaru
Directories=scalable/actions
[scalable/actions]
Size=16
Type=Scalable
MinSize=8
MaxSize=512
Context=Actions
THEME
if ! pgrep -u "$(id -u)" Xtigervnc >/dev/null; then
  rm -f "$HOME/.vnc/ready"
  Xtigervnc :1 -geometry 1600x900 -depth 24 -SecurityTypes None -localhost yes -AlwaysShared >"$HOME/.vnc/display.log" 2>&1 &
  sleep 2
  dbus-run-session -- bash -c '
    env > "$HOME/.vnc/session.env"
    export XDG_SESSION_TYPE=x11 XDG_CURRENT_DESKTOP=ubuntu:GNOME GNOME_SHELL_SESSION_MODE=ubuntu
    gsettings set org.gnome.desktop.interface gtk-theme Yaru
    gsettings set org.gnome.desktop.interface color-scheme prefer-light
    gsettings set org.gnome.desktop.interface icon-theme LabMateUbuntu
    gsettings set org.gnome.desktop.interface enable-animations false
    gsettings set org.gnome.desktop.notifications show-banners false
    gsettings set org.gnome.desktop.background picture-uri file:///usr/share/backgrounds/warty-final-ubuntu.png
    gsettings set org.gnome.desktop.background picture-uri-dark file:///usr/share/backgrounds/warty-final-ubuntu.png
    gsettings set org.gnome.shell favorite-apps "[\"org.gnome.Nautilus.desktop\", \"org.gnome.Ptyxis.desktop\", \"org.gnome.TextEditor.desktop\"]"
    gsettings set org.gnome.desktop.lockdown disable-lock-screen true
    gsettings set org.gnome.desktop.session idle-delay 0
    gsettings set org.gnome.TextEditor use-system-font false
    gsettings set org.gnome.TextEditor custom-font "Ubuntu Mono 11"
    gsettings set org.gnome.TextEditor style-scheme Adwaita
    gsettings set org.gnome.TextEditor style-variant light
    gsettings set org.gnome.TextEditor recolor-window false
    gsettings set org.gnome.TextEditor show-line-numbers false
    gsettings set org.gnome.TextEditor spellcheck false
    gsettings set org.gnome.TextEditor restore-session false
    gsettings set org.gnome.TextEditor line-height 1.0
    gsettings set org.gnome.TextEditor wrap-text true
    gsettings set org.gnome.Ptyxis interface-style dark
    gsettings set org.gnome.Ptyxis use-system-font false
    gsettings set org.gnome.Ptyxis font-name "Ubuntu Mono 11"
    gsettings set org.gnome.Ptyxis restore-session false
    gsettings set org.gnome.Ptyxis default-profile-uuid b5f46014cf554100b8094feefbb89fc0
    gsettings set org.gnome.Ptyxis profile-uuids "[\"b5f46014cf554100b8094feefbb89fc0\"]"
    gsettings set org.gnome.Ptyxis.Profile:/org/gnome/Ptyxis/Profiles/b5f46014cf554100b8094feefbb89fc0/ palette labmate-ubuntu
    gnome-session --session=ubuntu --disable-acceleration-check &
    session_pid=$!
    desktop_ready=0
    for attempt in $(seq 1 40); do
      if gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.freedesktop.DBus.Peer.Ping >/dev/null 2>&1; then
        touch "$HOME/.vnc/ready"
        desktop_ready=1
        break
      fi
      sleep 1
    done
    if [ "$desktop_ready" -ne 1 ]; then
      echo "GNOME did not become ready within 40 seconds" >&2
      exit 1
    fi
    # Terminal startup can lag behind GNOME Shell. Prime it briefly; the
    # execution worker also retries the actual native window when capturing.
    timeout 12 ptyxis --new-window || echo "Terminal startup deferred to the capture worker" >&2
    wait "$session_pid"
  ' >"$HOME/.vnc/gnome.log" 2>&1 &
fi
if ! pgrep -u "$(id -u)" -f "websockify.*6080" >/dev/null; then
  websockify --web=/usr/share/novnc 127.0.0.1:6080 127.0.0.1:5901 >"$HOME/.vnc/web.log" 2>&1 &
fi
