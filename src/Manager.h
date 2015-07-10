#ifndef MANAGER_H
#define MANAGER_H

#include <node.h>
#include <v8.h>
#include <uv.h>
#include <node_object_wrap.h>

#include <list>
#include <algorithm>
extern "C" {
  #include <X11/Xlib.h>
  #include <X11/Xproto.h>
  #include <X11/extensions/Xinerama.h>
  #include "utils/errors.h"
}

#include "Handler.h"

class Manager : public node::ObjectWrap, public EventHandler {
 public:
  static void Init(v8::Handle<v8::Object> exports);
  Display* dpy;
  Window root;
  int screen;
  std::list<Window>windows;
 private:
  explicit Manager();
  ~Manager();
  static void New(const v8::FunctionCallbackInfo<v8::Value>& args);
  static v8::Persistent<v8::Function> constructor;
  static void Manage(const v8::FunctionCallbackInfo<v8::Value>& args);
  // outside of V8 context

  static void EIO_Loop(uv_poll_t* handle, int status, int events);
  void scan();
  void add_window(Window win, XWindowAttributes *watt);
  void emit();
  void event_maprequest(XEvent *e);
};

#endif
