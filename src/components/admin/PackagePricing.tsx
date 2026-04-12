import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Package, Plus, Trash2, Edit, Loader2, Clock, Route, Settings, ChevronDown, ChevronUp, Infinity } from 'lucide-react';

interface PackagePricingProps {
  lang: string;
  routes: any[];
}

const PackagePricing = ({ lang, routes }: PackagePricingProps) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [timeRules, setTimeRules] = useState<any[]>([]);
  const [globalFactor, setGlobalFactor] = useState('1.0');
  const [loading, setLoading] = useState(true);

  // Template form
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name_en: '', name_ar: '', ride_count: 10, factor: 0.95, validity_days: 14, is_unlimited: false,
  });
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Override form
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideForm, setOverrideForm] = useState({ route_id: '', package_template_id: '', factor_override: 0.9 });
  const [savingOverride, setSavingOverride] = useState(false);

  // Time rule form
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [timeForm, setTimeForm] = useState({
    name_en: 'Peak Hours', name_ar: 'ساعات الذروة', route_id: '',
    day_of_week: [] as number[], start_time: '07:00', end_time: '09:00', factor: 1.1,
  });
  const [savingTime, setSavingTime] = useState(false);

  // Expand sections
  const [expandedSection, setExpandedSection] = useState<'templates' | 'overrides' | 'time' | 'global' | null>('templates');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [tRes, oRes, trRes, gRes] = await Promise.all([
      supabase.from('package_templates').select('*').order('sort_order'),
      supabase.from('route_package_overrides').select('*, routes(name_en, name_ar), package_templates(name_en, name_ar)').order('created_at'),
      supabase.from('time_based_pricing_rules').select('*, routes(name_en, name_ar)').order('created_at'),
      supabase.from('app_settings').select('value').eq('key', 'global_default_factor').single(),
    ]);
    setTemplates(tRes.data || []);
    setOverrides(oRes.data || []);
    setTimeRules(trRes.data || []);
    if (gRes.data) setGlobalFactor(gRes.data.value);
    setLoading(false);
  };

  const saveTemplate = async () => {
    setSavingTemplate(true);
    const payload = {
      name_en: templateForm.name_en,
      name_ar: templateForm.name_ar,
      ride_count: templateForm.is_unlimited ? null : templateForm.ride_count,
      factor: templateForm.factor,
      validity_days: templateForm.validity_days,
      is_active: true,
      sort_order: templates.length,
    };
    if (editingTemplateId) {
      const { error } = await supabase.from('package_templates').update(payload).eq('id', editingTemplateId);
      if (error) toast.error(error.message);
      else toast.success(lang === 'ar' ? 'تم تحديث الباقة' : 'Package updated');
    } else {
      const { error } = await supabase.from('package_templates').insert(payload);
      if (error) toast.error(error.message);
      else toast.success(lang === 'ar' ? 'تم إنشاء الباقة' : 'Package created');
    }
    setShowTemplateForm(false);
    setEditingTemplateId(null);
    setTemplateForm({ name_en: '', name_ar: '', ride_count: 10, factor: 0.95, validity_days: 14, is_unlimited: false });
    fetchAll();
    setSavingTemplate(false);
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from('package_templates').delete().eq('id', id);
    fetchAll();
    toast.success(lang === 'ar' ? 'تم حذف الباقة' : 'Package deleted');
  };

  const startEditTemplate = (t: any) => {
    setTemplateForm({
      name_en: t.name_en, name_ar: t.name_ar,
      ride_count: t.ride_count || 10,
      factor: Number(t.factor),
      validity_days: t.validity_days,
      is_unlimited: t.ride_count === null,
    });
    setEditingTemplateId(t.id);
    setShowTemplateForm(true);
  };

  const toggleTemplateActive = async (id: string, current: boolean) => {
    await supabase.from('package_templates').update({ is_active: !current }).eq('id', id);
    fetchAll();
  };

  const saveOverride = async () => {
    setSavingOverride(true);
    const { error } = await supabase.from('route_package_overrides').upsert({
      route_id: overrideForm.route_id,
      package_template_id: overrideForm.package_template_id,
      factor_override: overrideForm.factor_override,
    }, { onConflict: 'route_id,package_template_id' });
    if (error) toast.error(error.message);
    else { toast.success(lang === 'ar' ? 'تم الحفظ' : 'Saved'); setShowOverrideForm(false); fetchAll(); }
    setSavingOverride(false);
  };

  const deleteOverride = async (id: string) => {
    await supabase.from('route_package_overrides').delete().eq('id', id);
    fetchAll();
  };

  const saveTimeRule = async () => {
    setSavingTime(true);
    const payload = {
      name_en: timeForm.name_en, name_ar: timeForm.name_ar,
      route_id: timeForm.route_id || null,
      day_of_week: timeForm.day_of_week.length > 0 ? timeForm.day_of_week : null,
      start_time: timeForm.start_time || null,
      end_time: timeForm.end_time || null,
      factor: timeForm.factor,
      is_active: true,
    };
    if (editingTimeId) {
      const { error } = await supabase.from('time_based_pricing_rules').update(payload).eq('id', editingTimeId);
      if (error) toast.error(error.message);
      else toast.success(lang === 'ar' ? 'تم التحديث' : 'Updated');
    } else {
      const { error } = await supabase.from('time_based_pricing_rules').insert(payload);
      if (error) toast.error(error.message);
      else toast.success(lang === 'ar' ? 'تم الإنشاء' : 'Created');
    }
    setShowTimeForm(false);
    setEditingTimeId(null);
    setTimeForm({ name_en: 'Peak Hours', name_ar: 'ساعات الذروة', route_id: '', day_of_week: [], start_time: '07:00', end_time: '09:00', factor: 1.1 });
    fetchAll();
    setSavingTime(false);
  };

  const deleteTimeRule = async (id: string) => {
    await supabase.from('time_based_pricing_rules').delete().eq('id', id);
    fetchAll();
  };

  const saveGlobalFactor = async () => {
    const { error } = await supabase.from('app_settings').upsert(
      { key: 'global_default_factor', value: globalFactor },
      { onConflict: 'key' }
    );
    if (error) toast.error(error.message);
    else toast.success(lang === 'ar' ? 'تم حفظ المعامل الافتراضي' : 'Default factor saved');
  };

  const dayLabels = lang === 'ar'
    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleDay = (d: number) => {
    setTimeForm(prev => ({
      ...prev,
      day_of_week: prev.day_of_week.includes(d) ? prev.day_of_week.filter(x => x !== d) : [...prev.day_of_week, d],
    }));
  };

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const SectionHeader = ({ title, icon: Icon, section }: { title: string; icon: any; section: 'templates' | 'overrides' | 'time' | 'global' }) => (
    <button
      onClick={() => setExpandedSection(expandedSection === section ? null : section)}
      className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
    >
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary" />
        {title}
      </h3>
      {expandedSection === section ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
    </button>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <Package className="w-6 h-6 text-secondary" />
        {lang === 'ar' ? 'تسعير الباقات' : 'Package Pricing'}
      </h2>
      <p className="text-sm text-muted-foreground">
        {lang === 'ar'
          ? 'السعر النهائي = سعر الرحلة × عدد الرحلات × المعامل. أولوية المعامل: مسار → وقت → باقة → افتراضي'
          : 'Final Price = Route Price × Rides × Factor. Factor priority: Route override → Time rule → Package factor → Global default'}
      </p>

      {/* 1. Package Templates */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <SectionHeader title={lang === 'ar' ? 'قوالب الباقات' : 'Package Templates'} icon={Package} section="templates" />
        {expandedSection === 'templates' && (
          <div className="p-4 pt-0 space-y-4">
            <Button size="sm" onClick={() => { setShowTemplateForm(!showTemplateForm); setEditingTemplateId(null); setTemplateForm({ name_en: '', name_ar: '', ride_count: 10, factor: 0.95, validity_days: 14, is_unlimited: false }); }}>
              <Plus className="w-4 h-4 me-1" />{lang === 'ar' ? 'إضافة باقة' : 'Add Package'}
            </Button>

            {showTemplateForm && (
              <div className="bg-surface rounded-xl p-4 space-y-3 border border-border">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{lang === 'ar' ? 'الاسم (إنجليزي)' : 'Name (EN)'}</Label>
                    <Input value={templateForm.name_en} onChange={e => setTemplateForm(p => ({ ...p, name_en: e.target.value }))} placeholder="Starter" />
                  </div>
                  <div>
                    <Label>{lang === 'ar' ? 'الاسم (عربي)' : 'Name (AR)'}</Label>
                    <Input value={templateForm.name_ar} onChange={e => setTemplateForm(p => ({ ...p, name_ar: e.target.value }))} placeholder="مبدئي" dir="rtl" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={templateForm.is_unlimited} onCheckedChange={(v) => setTemplateForm(p => ({ ...p, is_unlimited: v }))} />
                  <Label className="flex items-center gap-1">
                    <Infinity className="w-4 h-4" />
                    {lang === 'ar' ? 'رحلات غير محدودة' : 'Unlimited rides'}
                  </Label>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {!templateForm.is_unlimited && (
                    <div>
                      <Label>{lang === 'ar' ? 'عدد الرحلات' : 'Rides'}</Label>
                      <Input type="number" value={templateForm.ride_count} onChange={e => setTemplateForm(p => ({ ...p, ride_count: parseInt(e.target.value) || 0 }))} />
                    </div>
                  )}
                  <div>
                    <Label>{lang === 'ar' ? 'المعامل' : 'Factor'}</Label>
                    <Input type="number" step="0.01" value={templateForm.factor} onChange={e => setTemplateForm(p => ({ ...p, factor: parseFloat(e.target.value) || 1 }))} />
                    <p className="text-[10px] text-muted-foreground mt-1">{lang === 'ar' ? '0.9 = خصم 10%' : '0.9 = 10% off'}</p>
                  </div>
                  <div>
                    <Label>{lang === 'ar' ? 'الصلاحية (أيام)' : 'Validity (days)'}</Label>
                    <Input type="number" value={templateForm.validity_days} onChange={e => setTemplateForm(p => ({ ...p, validity_days: parseInt(e.target.value) || 14 }))} />
                  </div>
                </div>
                <Button disabled={savingTemplate || !templateForm.name_en || !templateForm.name_ar} onClick={saveTemplate}>
                  {savingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingTemplateId ? (lang === 'ar' ? 'تحديث' : 'Update') : (lang === 'ar' ? 'إنشاء' : 'Create'))}
                </Button>
              </div>
            )}

            {templates.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-start p-2 font-medium text-muted-foreground">{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                      <th className="text-start p-2 font-medium text-muted-foreground">{lang === 'ar' ? 'الرحلات' : 'Rides'}</th>
                      <th className="text-start p-2 font-medium text-muted-foreground">{lang === 'ar' ? 'المعامل' : 'Factor'}</th>
                      <th className="text-start p-2 font-medium text-muted-foreground">{lang === 'ar' ? 'الصلاحية' : 'Validity'}</th>
                      <th className="text-start p-2 font-medium text-muted-foreground">{lang === 'ar' ? 'حالة' : 'Active'}</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map(t => (
                      <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="p-2 font-medium text-foreground">{lang === 'ar' ? t.name_ar : t.name_en}</td>
                        <td className="p-2 text-foreground">
                          {t.ride_count === null ? <span className="flex items-center gap-1"><Infinity className="w-3.5 h-3.5" /> {lang === 'ar' ? 'غير محدود' : 'Unlimited'}</span> : t.ride_count}
                        </td>
                        <td className="p-2 text-foreground font-mono">{Number(t.factor).toFixed(2)}</td>
                        <td className="p-2 text-muted-foreground">{t.validity_days} {lang === 'ar' ? 'يوم' : 'days'}</td>
                        <td className="p-2">
                          <Switch checked={t.is_active} onCheckedChange={() => toggleTemplateActive(t.id, t.is_active)} />
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => startEditTemplate(t)}>
                              <Edit className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteTemplate(t.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'لا توجد باقات بعد' : 'No packages yet'}</p>
            )}
          </div>
        )}
      </div>

      {/* 2. Route Overrides */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <SectionHeader title={lang === 'ar' ? 'معاملات المسارات' : 'Route Factor Overrides'} icon={Route} section="overrides" />
        {expandedSection === 'overrides' && (
          <div className="p-4 pt-0 space-y-4">
            <p className="text-xs text-muted-foreground">
              {lang === 'ar'
                ? 'تجاوز معامل الباقة لمسار معين (أولوية أعلى من معامل الباقة)'
                : 'Override a package factor for a specific route (highest priority)'}
            </p>
            <Button size="sm" onClick={() => setShowOverrideForm(!showOverrideForm)}>
              <Plus className="w-4 h-4 me-1" />{lang === 'ar' ? 'إضافة' : 'Add'}
            </Button>

            {showOverrideForm && (
              <div className="bg-surface rounded-xl p-4 space-y-3 border border-border">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>{lang === 'ar' ? 'المسار' : 'Route'}</Label>
                    <select className="w-full border border-border rounded-lg p-2 bg-card text-foreground text-sm"
                      value={overrideForm.route_id} onChange={e => setOverrideForm(p => ({ ...p, route_id: e.target.value }))}>
                      <option value="">{lang === 'ar' ? 'اختر' : 'Select'}</option>
                      {routes.filter(r => r.status === 'active').map(r => (
                        <option key={r.id} value={r.id}>{lang === 'ar' ? r.name_ar : r.name_en}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>{lang === 'ar' ? 'الباقة' : 'Package'}</Label>
                    <select className="w-full border border-border rounded-lg p-2 bg-card text-foreground text-sm"
                      value={overrideForm.package_template_id} onChange={e => setOverrideForm(p => ({ ...p, package_template_id: e.target.value }))}>
                      <option value="">{lang === 'ar' ? 'اختر' : 'Select'}</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{lang === 'ar' ? t.name_ar : t.name_en}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>{lang === 'ar' ? 'المعامل' : 'Factor'}</Label>
                    <Input type="number" step="0.01" value={overrideForm.factor_override} onChange={e => setOverrideForm(p => ({ ...p, factor_override: parseFloat(e.target.value) || 1 }))} />
                  </div>
                </div>
                <Button disabled={savingOverride || !overrideForm.route_id || !overrideForm.package_template_id} onClick={saveOverride}>
                  {savingOverride ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === 'ar' ? 'حفظ' : 'Save')}
                </Button>
              </div>
            )}

            {overrides.length > 0 ? (
              <div className="space-y-2">
                {overrides.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between bg-surface rounded-lg p-3 border border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {lang === 'ar' ? o.routes?.name_ar : o.routes?.name_en} → {lang === 'ar' ? o.package_templates?.name_ar : o.package_templates?.name_en}
                      </p>
                      <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'المعامل:' : 'Factor:'} {Number(o.factor_override).toFixed(2)}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteOverride(o.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'لا توجد تجاوزات' : 'No overrides yet'}</p>
            )}
          </div>
        )}
      </div>

      {/* 3. Time-Based Rules */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <SectionHeader title={lang === 'ar' ? 'قواعد التسعير الزمنية' : 'Time-Based Pricing Rules'} icon={Clock} section="time" />
        {expandedSection === 'time' && (
          <div className="p-4 pt-0 space-y-4">
            <p className="text-xs text-muted-foreground">
              {lang === 'ar'
                ? 'تطبيق معامل بناءً على اليوم أو الوقت (أولوية أعلى من معامل الباقة، أقل من المسار)'
                : 'Apply a factor based on day/time (higher priority than package factor, lower than route override)'}
            </p>
            <Button size="sm" onClick={() => { setShowTimeForm(!showTimeForm); setEditingTimeId(null); }}>
              <Plus className="w-4 h-4 me-1" />{lang === 'ar' ? 'إضافة' : 'Add'}
            </Button>

            {showTimeForm && (
              <div className="bg-surface rounded-xl p-4 space-y-3 border border-border">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{lang === 'ar' ? 'الاسم (EN)' : 'Name (EN)'}</Label>
                    <Input value={timeForm.name_en} onChange={e => setTimeForm(p => ({ ...p, name_en: e.target.value }))} />
                  </div>
                  <div>
                    <Label>{lang === 'ar' ? 'الاسم (AR)' : 'Name (AR)'}</Label>
                    <Input value={timeForm.name_ar} onChange={e => setTimeForm(p => ({ ...p, name_ar: e.target.value }))} dir="rtl" />
                  </div>
                </div>
                <div>
                  <Label>{lang === 'ar' ? 'المسار (اختياري)' : 'Route (optional)'}</Label>
                  <select className="w-full border border-border rounded-lg p-2 bg-card text-foreground text-sm"
                    value={timeForm.route_id} onChange={e => setTimeForm(p => ({ ...p, route_id: e.target.value }))}>
                    <option value="">{lang === 'ar' ? 'كل المسارات' : 'All routes'}</option>
                    {routes.filter(r => r.status === 'active').map(r => (
                      <option key={r.id} value={r.id}>{lang === 'ar' ? r.name_ar : r.name_en}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{lang === 'ar' ? 'أيام الأسبوع' : 'Days (empty = all)'}</Label>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {dayLabels.map((d, i) => (
                      <button key={i} onClick={() => toggleDay(i)}
                        className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${timeForm.day_of_week.includes(i) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>{lang === 'ar' ? 'من' : 'From'}</Label>
                    <Input type="time" value={timeForm.start_time} onChange={e => setTimeForm(p => ({ ...p, start_time: e.target.value }))} />
                  </div>
                  <div>
                    <Label>{lang === 'ar' ? 'إلى' : 'To'}</Label>
                    <Input type="time" value={timeForm.end_time} onChange={e => setTimeForm(p => ({ ...p, end_time: e.target.value }))} />
                  </div>
                  <div>
                    <Label>{lang === 'ar' ? 'المعامل' : 'Factor'}</Label>
                    <Input type="number" step="0.01" value={timeForm.factor} onChange={e => setTimeForm(p => ({ ...p, factor: parseFloat(e.target.value) || 1 }))} />
                  </div>
                </div>
                <Button disabled={savingTime || !timeForm.name_en} onClick={saveTimeRule}>
                  {savingTime ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingTimeId ? (lang === 'ar' ? 'تحديث' : 'Update') : (lang === 'ar' ? 'إنشاء' : 'Create'))}
                </Button>
              </div>
            )}

            {timeRules.length > 0 ? (
              <div className="space-y-2">
                {timeRules.map((tr: any) => (
                  <div key={tr.id} className="flex items-center justify-between bg-surface rounded-lg p-3 border border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">{lang === 'ar' ? tr.name_ar : tr.name_en}</p>
                      <p className="text-xs text-muted-foreground">
                        {tr.routes ? (lang === 'ar' ? tr.routes.name_ar : tr.routes.name_en) : (lang === 'ar' ? 'كل المسارات' : 'All routes')}
                        {tr.start_time && tr.end_time && ` · ${tr.start_time.slice(0,5)}–${tr.end_time.slice(0,5)}`}
                        {tr.day_of_week && tr.day_of_week.length > 0 && ` · ${tr.day_of_week.map((d: number) => dayLabels[d]).join(', ')}`}
                        {` · ×${Number(tr.factor).toFixed(2)}`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => {
                        setTimeForm({
                          name_en: tr.name_en, name_ar: tr.name_ar,
                          route_id: tr.route_id || '',
                          day_of_week: tr.day_of_week || [],
                          start_time: tr.start_time?.slice(0, 5) || '07:00',
                          end_time: tr.end_time?.slice(0, 5) || '09:00',
                          factor: Number(tr.factor),
                        });
                        setEditingTimeId(tr.id);
                        setShowTimeForm(true);
                      }}>
                        <Edit className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteTimeRule(tr.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'لا توجد قواعد' : 'No time rules yet'}</p>
            )}
          </div>
        )}
      </div>

      {/* 4. Global Default Factor */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <SectionHeader title={lang === 'ar' ? 'المعامل الافتراضي' : 'Global Default Factor'} icon={Settings} section="global" />
        {expandedSection === 'global' && (
          <div className="p-4 pt-0 space-y-3">
            <p className="text-xs text-muted-foreground">
              {lang === 'ar'
                ? 'يُستخدم عند عدم وجود تجاوز مسار أو قاعدة زمنية أو معامل باقة'
                : 'Used when no route override, time rule, or package factor applies'}
            </p>
            <div className="flex gap-2 max-w-xs">
              <Input type="number" step="0.01" value={globalFactor} onChange={e => setGlobalFactor(e.target.value)} />
              <Button onClick={saveGlobalFactor}>{lang === 'ar' ? 'حفظ' : 'Save'}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PackagePricing;
