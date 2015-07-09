#ifndef MANAGER_H
#define MANAGER_H

#include <node.h>
#include <v8.h>
#include <node_object_wrap.h>
extern "C" {
  #include <X11/Xlib.h>
  #include <X11/extensions/Xinerama.h>
  #include "cutils/errors.h"
}


class Manager : public node::ObjectWrap {
 public:
  static void Init(v8::Handle<v8::Object> exports);
  Display* dpy;
  Window root;
  int screen;

 private:
  explicit Manager();
  ~Manager();
  static void New(const v8::FunctionCallbackInfo<v8::Value>& args);
  static v8::Persistent<v8::Function> constructor;

  static void Manage(const v8::FunctionCallbackInfo<v8::Value>& args);
  //
  void scan();
  void add_window(Window win, XWindowAttributes *watt);
  void emit();
};

#endif
