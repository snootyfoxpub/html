const assert = require('assert');
const h = require('..');
const { G } = require('func-helpers');

describe('HTML Builder', function () {
  describe('tag builder', function () {
    it('should return return plain tag if no attrs and content specified', function () {
      assert.equal(h('div')(), '<div></div>');
    });

    it('should add id attr passed by # in tag description', function () {
      assert.equal(h('div#test')(), '<div id="test"></div>');
    });

    it('should add class attr passed by . in tag description', function () {
      assert.equal(h('div.class1.class2')(), '<div class="class1 class2"></div>');
    });

    it('should add class attr passed by class property', function () {
      assert.equal(h('div.class1', { class: 'class2' })(), '<div class="class1 class2"></div>');
    });

    it('should add class attr passed by class property as functional hash', function () {
      assert.equal(h('div.class1', { class: { 'class2': true } })(), '<div class="class1 class2"></div>');
      assert.equal(h('div.class1', { class: { 'class2': G('bla') } })({ bla: true }), '<div class="class1 class2"></div>');
    });

    it('should add attrs passed by hash ', function () {
      assert.equal(h('div', { test: 'bla' })(), '<div test="bla"></div>');
    });

    it('should attrs compute functions in attributes', function () {
      assert.equal(h('div', { test: G('test') })({ test: 'bla' }), '<div test="bla"></div>');
    });

    it('should render strings inside content', function () {
      assert.equal(h('div', 'test1', 'test2')(), '<div>test1test2</div>');
    });

    it('should render embeded function with context', function () {
      assert.equal(h('div', G('test'))({ test: 'bla' }), '<div>bla</div>');
      assert.equal(h('div', h('span', G('test')))({ test: 'bla' }), '<div><span>bla</span></div>');
    });

    it('should override id from attrs', function () {
      assert.equal(h('div#old', { id: 'new' })(), '<div id="new"></div>');
    });

    it('should escape html strings', function () {
      assert.equal(h('div', h('span', '&&'))(), '<div><span>&amp;&amp;</span></div>');
      assert.equal(h('div', h('span', G('bla')))({ bla: '&&' }), '<div><span>&amp;&amp;</span></div>');
    });

    it('should escape attributes', function () {
      assert.equal(h('div', { text: '&&' } )(), '<div text="&amp;&amp;"></div>');
    });
  });

  describe('h.safe', function () {
    it('should disable escaping', function () {
      assert.equal(h('div', h.safe('&&'))(), '<div>&&</div>');
      assert.equal(h('div', h.safe(h('span', G('bla'), '&'), '&'))({ bla: '&&' }), '<div><span>&&&</span>&</div>');
    });
  });

  describe('h.each', function () {
    before(function () {
      this.context = {
        rootValue: 'bla1',
        collection: [
          { val: 'test1'},
          { val: 'test2', internal: [{ val: 'test3' }] }
        ]
      };
    });
    it('should iterate in collecition', function () {
      assert.equal(
        h('div',
          h.each('collection', h('a', G('entry.val')))
        )(this.context),
        '<div><a>test1</a><a>test2</a></div>'
      );
    });

    it('should preserve parent', function () {
      assert.equal(
        h('div',
          h.each('collection', h('a', G('entry.val'), G('parent.rootValue')))
        )(this.context),
        '<div><a>test1bla1</a><a>test2bla1</a></div>'
      );
    });

    it('should preserve root context on all levels', function () {
      assert.equal(
        h('div',
          h.each('collection',
            h('a', h.each('entry.internal',
              h('i', G('entry.val'), G('$root.rootValue'))
            ))
          )
        )(this.context),
        '<div><a></a><a><i>test3bla1</i></a></div>'
      );
    });
  });

  describe('h.group', function () {
    it('should just render and concat arguments', function () {
      assert.equal(
        h.group(h('div', 'test1'), h('div', 'test2'))(),
        '<div>test1</div><div>test2</div>'
      );
    });
  });

  describe('h.if', function () {
    it('should render second or third argiment accordind first argument result', function() {
      assert.equal(h.if(G('bla'), h('div'), h('span'))({ bla: true }), '<div></div>');
      assert.equal(h.if(G('bla'), h('div'), h('span'))({ bla: false }), '<span></span>');
    });
  });
});
