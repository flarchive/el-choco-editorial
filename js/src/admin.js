import app from 'flarum/admin/app';
import Admin from 'flarum/common/extenders/Admin';

const tr = (key) => app.translator.trans('el-choco-editorial.admin.' + key);

export const extend = [new Admin()
  .setting(() => ({ setting: 'el-choco-editorial.approvals', type: 'select', default: '1',
    label: tr('approvals'), help: tr('approvals_help'), options: { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5' } }))
  .permission(() => ({ icon: 'fas fa-pen-nib', label: tr('use'), permission: 'el-choco-editorial.use' }), 'start')
  .permission(() => ({ icon: 'fas fa-user-shield', label: tr('manage'), permission: 'el-choco-editorial.manage' }), 'moderate')];
