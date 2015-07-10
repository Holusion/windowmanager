# Node addons

## libuv

bien que rrement précisé, il faut inclure le header :

    #include <uv.h>

### contexte

La transmission du contexte est permise par le champ data présent dans tous les handlers libuv

    uv_poll_t* handle = new uv_poll_t;
    handle->data = obj;

Puis :

    MyClass* obj = static_cast<MyClass*> handle->data;



### File polling

A partir d'un *file decriptor*.
    uv_poll_t* handle = new uv_poll_t;
    handle->data = obj;
    uv_poll_init(uv_default_loop(), handle, fd);
    uv_poll_start(handle, UV_READABLE, Loop_handler);
