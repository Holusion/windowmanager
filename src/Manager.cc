#include "Manager.h"

using namespace v8;

Persistent<Function> Manager::constructor;

Manager::Manager() {
  Isolate* isolate = Isolate::GetCurrent();
  HandleScope scope(isolate);
  if ( ( this->wm.dpy = XOpenDisplay(NULL) ) == NULL ) {
    isolate->ThrowException(Exception::Error(String::NewFromUtf8(isolate,"cannot connect to X server " )));

  }else{
    this->wm.screen = DefaultScreen(this->wm.dpy);
    this->wm.root = RootWindow(this->wm.dpy, this->wm.screen);
  }
}

Manager::~Manager() {
  if(this->wm.dpy){
    XCloseDisplay(this->wm.dpy);
  }
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
  XSelectInput(obj->wm.dpy,obj->wm.root,
                   SubstructureRedirectMask|SubstructureNotifyMask|ButtonPressMask
                  |EnterWindowMask|LeaveWindowMask|StructureNotifyMask
                  |PropertyChangeMask);
  
  XSync(obj->wm.dpy, False);
  //Now manage events
  int fd = XConnectionNumber(obj->wm.dpy);
  uv_poll_t* handle = new uv_poll_t;
  handle->data = obj;
  //obj.Ref(); //Necessary?
  uv_poll_init(uv_default_loop(), handle, fd);
  uv_poll_start(handle, UV_READABLE, EIO_Loop);
  args.GetReturnValue().Set(Number::New(isolate, fd));
}

void Manager::EIO_Loop(uv_poll_t* handle, int status, int events) {
  XEvent event;
  Manager* obj = static_cast<Manager*>(handle->data);
  // main event loop
  while(XPending(obj->wm.dpy)) {
   XNextEvent(obj->wm.dpy, &event);
   //Handle event
   //fprintf(stderr, "Got %s (%d)\n", event_names[event.type], event.type);
   switch(event.type){
     case MapRequest:
     obj->search(event.xmaprequest.window);
      event_maprequest(&event,&obj->wm);
      break;
    case DestroyNotify:
      //obj->event_destroynotify(&event);
      break;
    case ConfigureRequest:
      //event_configurerequest(&event);
      break;
   }
 }
}
void Manager::search (Window win){
  XWindowAttributes wa;
  if(!XGetWindowAttributes(this->wm.dpy, win, &wa)
    || wa.override_redirect ) {
    fprintf(stderr, "XGetWindowAttributes failed\n");
    return;
  }
  List* found = NULL;
  List_search(this->wm.windows, found, (void*) win);
  if(!found) { // only map new windows
    this->add_window(win, &wa);
    // emit a rearrange
  }
}
void Manager::scan (){
  unsigned int i, num;
  Window d1, d2, *wins = NULL;
  XWindowAttributes watt;
  if(XQueryTree(this->wm.dpy, this->wm.root, &d1, &d2, &wins, &num)) {
   for(i = 0; i < num; i++) {
     search(wins[i]);
   }
   for(i = 0; i < num; i++) { /* now the transients */
     if(!XGetWindowAttributes(this->wm.dpy, wins[i], &watt))
       continue;
     if(XGetTransientForHint(this->wm.dpy, wins[i], &d1)
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
  XGetTransientForHint(this->wm.dpy, win, &trans);
  isfloating = (trans != None);
  List_push(&this->wm.windows, (void *)win);

  if(isfloating) {
    XRaiseWindow(this->wm.dpy, win);
  }
  XChangeSaveSet(this->wm.dpy,win,SetModeInsert);
  XReparentWindow(this->wm.dpy,win,this->wm.root,0,0);
  XMapWindow(this->wm.dpy, win);
}

void Manager::remove_window(Window win){
  List *item = NULL;
  List_search(this->wm.windows, item, (void*) win);
  if(item){
    List_remove(&this->wm.windows,item);
  }
}
