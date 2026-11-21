import app from 'flarum/admin/app';
import Admin from 'flarum/common/extenders/Admin';

const tr = (key) => app.translator.trans('el-choco-editorial.admin.' + key);

export const extend = [new Admin()
  .setting(() => ({ setting: 'el-choco-editorial.approvals', type: 'select', default: '1',
    label: tr('approvals'), help: tr('approvals_help'), options: { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5' } }))
  .setting(() => ({ setting: 'el-choco-editorial.home_banner', type: 'boolean', default: '1', label: tr('home_banner') }))
  .setting(() => ({ setting: 'el-choco-editorial.home_title', type: 'text', maxlength: 120, label: tr('home_title'), help: tr('home_fallback') }))
  .setting(() => ({ setting: 'el-choco-editorial.home_description', type: 'textarea', maxlength: 500, label: tr('home_description'), help: tr('home_fallback') }))
  .setting(() => ({ setting: 'el-choco-editorial.home_welcome', type: 'textarea', maxlength: 1500, label: tr('home_welcome'), help: tr('home_welcome_help') }))
  .setting(() => ({ setting: 'el-choco-editorial.home_layout', type: 'select', default: 'cards', label: tr('home_layout'),
    options: { cards: tr('layout_cards'), list: tr('layout_list') } }))
  .setting(() => ({ setting: 'el-choco-editorial.home_sort', type: 'select', default: 'latest', label: tr('home_sort'),
    options: { latest: tr('sort_latest'), oldest: tr('sort_oldest'), title: tr('sort_title') } }))
  .setting(() => ({ setting: 'el-choco-editorial.home_status', type: 'select', default: 'all', label: tr('home_status'),
    options: Object.fromEntries(['all', 'draft', 'review', 'approved', 'published', 'archived'].map((status) => [status, tr('status_' + status)])) }))
  .permission(() => ({ icon: 'fas fa-pen-nib', label: tr('use'), permission: 'el-choco-editorial.use' }), 'start')
  .permission(() => ({ icon: 'fas fa-check-double', label: tr('approve_directly'), permission: 'el-choco-editorial.approveDirectly' }), 'moderate')
  .permission(() => ({ icon: 'fas fa-user-shield', label: tr('manage'), permission: 'el-choco-editorial.manage' }), 'moderate')];
