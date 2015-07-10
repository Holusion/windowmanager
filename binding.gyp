{
  "targets": [
    {
      "target_name": "Manager",
      "dependencies":["utils"],
      "sources": [ "src/main.cc","src/Manager.cc","src/Handler.cc" ],
      "cflags":['-std=c++11',"-pedantic"],
      'link_settings': {
        'libraries': [
          '<!@(pkg-config --libs x11)'
        ]
      }
    },
    {
      "target_name":"utils",
      'type': 'static_library',
      'sources':["src/utils/errors.c"],
      "cflags":['-std=c99'],
      'link_settings': {
        'libraries': [
          '<!@(pkg-config --libs x11)'
        ]
      }
    }
  ]
}
