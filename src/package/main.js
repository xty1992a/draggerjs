/**
 * Created by TY-xie on 2018/3/29.
 */
import {css, getParentByClassName, isMobile} from './dom'

//  region 工具函数
class Rect {
  constructor(opt) {
	Object.assign(this, opt)
  }

  get centerX() {
	return this.left + this.width / 2
  }

  get centerY() {
	return this.top + this.height / 2
  }

  get bottom() {
	return this.top + this.height
  }

  get right() {
	return this.left + this.width
  }
}

const helper = {
  // 获得元素相对于父元素的位置
  getPosOfParent(el) {
	let parent = el.parentNode
	let pR = parent.getBoundingClientRect()
	let cR = el.getBoundingClientRect()
	return new Rect({
	  width: cR.width,
	  height: cR.height,
	  top: cR.top - pR.top,
	  left: cR.left - pR.left,
	  // right: cR.right - pR.left,
	  // bottom: cR.bottom - pR.top,  // 子元素的bottom为距离父元素顶部的距离
	  index: el.dataset.hasOwnProperty('index') ? +el.dataset.index : -1,
	})
  },
  isCover(rect1, rect2, isY = true) {
	if (isY) {
	  let max = Math.max(rect1.centerY, rect2.centerY)
	  let min = Math.min(rect1.centerY, rect2.centerY)
	  return (max - min) < ((rect1.height + rect2.height) / 2)
	}
	else {
	  let max = Math.max(rect1.centerX, rect2.centerX)
	  let min = Math.min(rect1.centerX, rect2.centerX)
	  return (max - min) < ((rect1.width + rect2.width) / 2)
	}
  },
}

// 事件名称
const events = {
  down: isMobile ? 'touchstart' : 'mousedown',
  move: isMobile ? 'touchmove' : 'mousemove',
  up: isMobile ? 'touchend' : 'mouseup',
}

// 默认配置
const initialOption = {
  dir: 'y',
  change: true,
}

// endregion

// 允许类绑定回调
class EmitAble {
  task = {}

  on(event, callback) {
	this.task[event] = callback
  }

  fire(event, payload) {
	this.task[event] && this.task[event](payload)
  }
}

export default class Main extends EmitAble {
  // region props
  children = []
  rectList = []         // 元素的位置数组
  threshold = []        // 元素的槛值,用于确定元素的位置

  point = null          // 手指/鼠标落点的信息
  drag = null
  dragIndex = -1        // 手指/鼠标落点的索引
  moveRect = null

  get currentRect() {
	return this.rectList[this.dragIndex] || null
  }

  // endregion
  constructor(el, opt) {
	super()
	this.$el = el
	this.$options = {...initialOption, ...opt}
	this.$init()
  }

  $init() {
	this.freshThreshold()
	this.listen()
  }

  // 自动交换元素
  changeItem({source, target}) {
	if (source === target) return;

	const parent = this.$el;

	let list = [...parent.children];

	// 取出被拖拽元素
	let temp = list.splice(source, 1);
	// 截取开头到被交换位置的元素
	let start = list.splice(0, target);
	// 组装成结果数组
	list = [...start, ...temp, ...list];

	// 用fragment优化dom操作.
	const frag = document.createDocumentFragment();
	list.forEach(el => frag.appendChild(el));
	parent.innerHTML = '';
	parent.appendChild(frag);

	// 刷新dragger实例
	this.freshThreshold();
  }

  // 获取元素槛值
  freshThreshold() {
	this.children = [...this.$el.children]
	this.children.forEach((child, index) => {
	  child.classList.add('drag-item')
	  child.dataset.index = index
	  child.dataset.moved = false
	})
	let rectList = this.rectList = this.children.map(child => helper.getPosOfParent(child))
	if (this.$options.dir === 'x') {
	  this.threshold = rectList.map(({centerX}) => centerX)
	}
	if (this.$options.dir === 'y') {
	  this.threshold = rectList.map(({centerY}) => centerY)
	}
  }

  // 监听事件
  listen() {
	this.$el.addEventListener(events.down, this.down)
	this.$el.addEventListener(events.move, this.move)
	document.addEventListener(events.up, this.up)
  }

  unbindListener() {
	this.$el.removeEventListener(events.down, this.down)
	this.$el.removeEventListener(events.move, this.move)
	document.removeEventListener(events.up, this.up)
  }

  // 寻找受影响最远的元素
  findTarget() {
	let target = this.children.find(child => JSON.parse(child.dataset.moved)) || this.drag
	if (target.dataset.index > this.currentRect.index) {
	  target = this.children.reverse().find(child => JSON.parse(child.dataset.moved))
	}
	return +target.dataset.index
  }

  effectSibling() {
	if (this.$options.dir === 'y') {
	  let dir = this.moveRect.top < this.currentRect.top ? 'up' : 'down'
	  if (dir === 'up') this.effectTop()
	  if (dir === 'down') this.effectBottom()
	}
	else {
	  let dir = this.moveRect.left < this.currentRect.left ? 'left' : 'right'
	  if (dir === 'left') this.effectLeft()
	  if (dir === 'right') this.effectRight()
	}
  }

  effectTop() {
	let {index, height} = this.currentRect
	let list = this.rectList.slice(0, index)
	list.forEach(rect => {
	  let y = rect.centerY > this.moveRect.top ? height : 0
	  this.children[rect.index].dataset.moved = Boolean(y)
	  css(this.children[rect.index], {
		transform: `translate3d(0, ${y}px, 0)`,
	  })
	})
  }

  effectBottom() {
	let {index, height} = this.currentRect
	let list = this.rectList.slice(index + 1)
	list.forEach((rect) => {
	  let y = rect.centerY < this.moveRect.bottom ? -height : 0
	  this.children[rect.index].dataset.moved = Boolean(y)
	  css(this.children[rect.index], {
		transform: `translate3d(0, ${y}px, 0)`,
	  })
	})
  }

  effectLeft() {
	let {index, width} = this.currentRect
	let list = this.rectList.slice(0, index)
	list.forEach(rect => {
	  let x = rect.centerX > this.moveRect.left ? width : 0
	  this.children[rect.index].dataset.moved = Boolean(x)
	  css(this.children[rect.index], {
		transform: `translate3d( ${x}px,0, 0)`,
	  })
	})
  }

  effectRight() {
	let {index, width} = this.currentRect
	let list = this.rectList.slice(index + 1)
	list.forEach(rect => {
	  let x = rect.centerX < this.moveRect.right ? -width : 0
	  this.children[rect.index].dataset.moved = Boolean(x)
	  css(this.children[rect.index], {
		transform: `translate3d( ${x}px,0, 0)`,
	  })
	})
  }

  down = (e) => {
	let target = getParentByClassName(e.target, 'drag-item')
	if (!target) return
	this.moved = false
	this.downTime = new Date().getTime()
	this.dragStart = true
	let {clientX, clientY} = e.touches ? e.touches[0] : e
	this.drag = target
	css(target, {
	  zIndex: 10,
	})
	this.dragIndex = +target.dataset.index
	this.children.forEach((child, index) => {
	  if (child === target) {
		child.classList.add('drag-handler')
	  }
	  else {
		child.classList.add('drag-move')
	  }
	})
	this.moveRect = helper.getPosOfParent(this.drag)
	let rect = target.getBoundingClientRect()
	this.point = {
	  posX: clientX - rect.left,
	  posY: clientY - rect.top,
	  startX: clientX,
	  startY: clientY,
	  moveX: clientX,
	  moveY: clientY,
	}
  }

  move = (e) => {
	e.preventDefault()
	if (!this.dragStart) return
	this.moved = true
	let {clientX, clientY} = e.touches ? e.touches[0] : e
	let {startX, startY} = this.point
	let deltaY = clientY - startY
	let deltaX = clientX - startX
	this.moveRect.top = this.rectList[this.dragIndex].top + deltaY
	this.moveRect.left = this.rectList[this.dragIndex].left + deltaX
	css(this.drag, {
	  transform: `translate3d(${deltaX}px,${deltaY}px,0)`,
	})
	this.point.moveX = clientX
	this.point.moveY = clientY
	this.effectSibling()
	return false
  }

  up = (e) => {
	e.preventDefault()
	if (!this.dragStart) return
	let targetIndex = this.findTarget()
	this.dragStart = false
	this.point = null
	this.children.forEach(child => {
	  css(child, {
		transform: `translate3d(0,0,0)`,
		zIndex: 0,
		opacity: 1,
	  })
	  child.classList.remove('drag-move')
	  child.classList.remove('drag-handler')
	})
	let gapTime = new Date().getTime() - this.downTime
	if (this.moved && gapTime > 100) {
	  let pos = {
		source: this.dragIndex,
		target: targetIndex,
	  }
	  this.fire('drag-over', pos)
	  this.$options.change && this.changeItem(pos)
	}
	else {
	  this.fire('click-over', {index: this.dragIndex, rect: this.currentRect})
	}
	this.drag = null
	this.moveRect = null
	this.dragIndex = -1
	return false
  }

  destroy() {
	this.unbindListener()
  }
}
