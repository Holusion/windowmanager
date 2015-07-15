#ifndef MANAGER_H
#define MANAGER_H

#include <node.h>
#include <v8.h>
#include <uv.h>
#include <node_object_wrap.h>

extern "C" {
  #include <X11/Xlib.h>
  #include <X11/Xproto.h>
  #include <X11/extensions/Xinerama.h>
  #include "utils/errors.h"
  #include "utils/x_events.h"
  #include "utils/wm.h"
}


class Manager : public node::ObjectWrap {
 public:
  static void Init(v8::Handle<v8::Object> exports);
  Wm wm;
 private:
  explicit Manager();
  ~Manager();
  static void New(const v8::FunctionCallbackInfo<v8::Value>& args);
  static v8::Persistent<v8::Function> constructor;
  static void Manage(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void EIO_Loop(uv_poll_t* handle, int status, int events);
  // outside of V8 context

  void add_window(Window win, XWindowAttributes *watt);
  void remove_window(Window win);
  void search(Window win);
  void scan();
  void emit();
};

#endif
