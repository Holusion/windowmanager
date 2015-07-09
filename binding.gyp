{
  "targets": [
    {
      "target_name": "Manager",
      "dependencies":["cutils"],
      "sources": [ "src/main.cc","src/Manager.cc" ],
      'link_settings': {
        'libraries': [
          '<!@(pkg-config --libs x11)'
        ]
      }
    },
    {
      "target_name":"cutils",
      'type': 'static_library',
      'sources':["src/cutils/errors.c"],
      "cflags":['-std=c99'],
      'link_settings': {
        'libraries': [
          '<!@(pkg-config --libs x11)'
        ]
      }
    }
  ]
}
