#include "Manager.h"

using namespace v8;

Persistent<Function> Manager::constructor;

Manager::Manager() {
  Isolate* isolate = Isolate::GetCurrent();
  HandleScope scope(isolate);
  if ( ( this->dpy = XOpenDisplay(NULL) ) == NULL ) {
    isolate->ThrowException(Exception::Error(String::NewFromUtf8(isolate,"cannot connect to X server " )));

  }else{
    this->screen = DefaultScreen(this->dpy);
    this->root = RootWindow(this->dpy, this->screen);
  }
}

Manager::~Manager() {
}

void Manager::Init(Handle<Object> exports) {
  Isolate* isolate = Isolate::GetCurrent();

  // Prepare constructor template
  Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, New);
  tpl->SetClassName(String::NewFromUtf8(isolate, "Manager"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  // Prototype
  NODE_SET_PROTOTYPE_METHOD(tpl, "manage", Manage);

  constructor.Reset(isolate, tpl->GetFunction());
  exports->Set(String::NewFromUtf8(isolate, "Manager"),
               tpl->GetFunction());
}

void Manager::New(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = Isolate::GetCurrent();
  HandleScope scope(isolate);

  if (args.IsConstructCall()) {
    // Invoked as constructor: `new Manager(...)`
    Manager* obj = new Manager();
    obj->Wrap(args.This());
    args.GetReturnValue().Set(args.This());
  } else {
    // Invoked as plain function `Manager(...)`, turn into construct call.
    const int argc = 1;
    Local<Value> argv[argc] = { args[0] };
    Local<Function> cons = Local<Function>::New(isolate, constructor);
    args.GetReturnValue().Set(cons->NewInstance(argc, argv));
  }
}
void Manager::Manage(const v8::FunctionCallbackInfo<v8::Value>& args){
  Isolate* isolate = Isolate::GetCurrent();
  HandleScope scope(isolate);
  Manager* obj = ObjectWrap::Unwrap<Manager>(args.Holder());
  XSelectInput(obj->dpy,obj->root,
                   SubstructureRedirectMask|SubstructureNotifyMask|ButtonPressMask
                  |EnterWindowMask|LeaveWindowMask|StructureNotifyMask
                  |PropertyChangeMask);

  obj->scan();
  XSync(obj->dpy, False);
  args.GetReturnValue().Set(Number::New(isolate, XConnectionNumber(obj->dpy)));
}
void Manager::scan (){
  unsigned int i, num;
  Window d1, d2, *wins = NULL;
  XWindowAttributes watt;
  if(XQueryTree(this->dpy, this->root, &d1, &d2, &wins, &num)) {
   for(i = 0; i < num; i++) {
     // if we can't read the window attributes,
     // or the window is a popup (transient or override_redirect), skip it
     if(!XGetWindowAttributes(this->dpy, wins[i], &watt)
     || watt.override_redirect || XGetTransientForHint(this->dpy, wins[i], &d1)) {
       continue;
     }
     // visible or minimized window ("Iconic state")
     if(watt.map_state == IsViewable )//|| getstate(wins[i]) == IconicState)
       add_window(wins[i], &watt);
   }
   for(i = 0; i < num; i++) { /* now the transients */
     if(!XGetWindowAttributes(this->dpy, wins[i], &watt))
       continue;
     if(XGetTransientForHint(this->dpy, wins[i], &d1)
     && (watt.map_state == IsViewable )) //|| getstate(wins[i]) == IconicState))
       add_window(wins[i], &watt);
   }
   if(wins) {
     XFree(wins);
   }
  }
}
void Manager::add_window(Window win, XWindowAttributes *watt){
  Window trans = None;
  Bool isfloating = False;
  XConfigureEvent ce;
  //nwm_window event_data;
  XWindowChanges wc;

  XGetTransientForHint(this->dpy, win, &trans);
  isfloating = (trans != None);
}
