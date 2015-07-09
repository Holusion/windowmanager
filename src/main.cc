#include <node.h>
#include "Manager.h"
using namespace v8;

void InitAll(Handle<Object> exports) {
  Manager::Init(exports);
}

NODE_MODULE(Manager, InitAll)
