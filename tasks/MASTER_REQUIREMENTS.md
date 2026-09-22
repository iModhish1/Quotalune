# QuotaArc — سجل المتطلبات الرئيسي

تحديث: 2026-09-06. مصدر المتطلبات: رسائل المستخدم المتاحة في سياق هذه المحادثة والصور المرفقة، وليست وعود الإنجاز السابقة. لم تُسترجع رسائل غير متاحة أو محادثات أخرى. هذا السجل يوسّع خطة الهدف الجاري ولا يستبدل نطاقه. جميع البنود التالية مفتوحة ما لم يُربط بها دليل قبول يغطي الطلب كاملاً.

## قواعد الاستمرار وعدم إسقاط الطلبات

### إضافة هدف الاستمرار — إعادة بناء واجهة البرنامج بالكامل

- F11 (مفتوح): إعادة بناء بنية جميع صفحات البرنامج وهوية التحكم بحيث لا تبدو امتداداً لـCodexBar؛ معالجة الأشكال البدائية والهوامش والألوان والتسلسل البصري في كل صفحة.
- F12 (مفتوح): اختبار نسخة Windows نفسها والتحكم بها كلما سمحت أداة الجلسة؛ لا تُستبدل أدلة native بمعاينة المتصفح. السماح الواسع من المستخدم لا يبرر تجاوز قيود الأمان أو الادعاء برؤية غير متاحة.
- F13 (جزئي قوي): منع أي تغيير تلقائي لمقاس النافذة عند الانتقال بين الصفحات، مع حفظ المقاس اليدوي وحالات التكبير وملء الشاشة. التنقل الداخلي أصبح محلياً وsame-mode retarget لا يعيد إظهار نافذة ظاهرة؛ اختبارات React/Rust مثبتة، وتبقى مصفوفة Windows الأصلية.
- E08 (جزئي): معاينات عالية الجودة وملونة وحركية عند الحاجة لكل بنية وثيم ووضع وموضع، على أن تستخدم الثيم الفعلي ولا تكون مجرد أسماء أو ألوان ثابتة. معرض البنيات يستخدم renderer الحقيقي والثيم الفعلي ويعرض أبعاد compact؛ بقية الأوضاع/المواضع والثيمات والقبول الأصلي مفتوحة.
- G08 (مفتوح): صفحة تخصيص إشعارات كاملة تشمل حدود كل نافذة استخدام، الوقت المتبقي، إعادة التعيين المتوقعة وغير المتوقعة، والرصيد؛ كل خيار مستقل وقابل للتعطيل والترتيب حيث ينطبق.

- 2026-09-06: طلب المستخدم «keep working» يؤكد استمرار النطاق الكامل؛ لا يسقط أي بند سابق. الدفعة الحالية Crescent Rail مرتبطة بـB وE، وليست إعلان اكتمال البنيات أو الإصدار.

### إضافة المستخدم — 2026-09-06، صور c82e84d2 إلى 118fceb5

- D12 (جزئي مثبت بالكود): Session وCodex Spark 5-hour وأي 5-hour إضافي يحتفظ كل منها بمعرّف واختيار وترتيب مستقل؛ لا دمج حسب المدة أو الاسم. إن كان المصدر نفسه يصف حداً واحداً باسم Session (5h) فلا يُختلق حد ثانٍ. بقي التحقق المرئي الأصلي ومراجعة جميع مزودي البيانات الفعلية.
- A06 (جزئي قوي): خمس نسخ لونية متدرجة لنفس شعار About مع اختيار صريح وحجم محفوظين في الإعدادات الأصلية؛ بقي توطين النصوص والقبول البصري الأصلي.
- F09 (مفتوح): إصلاح تسرب تنسيق أزرار الوضع النهاري إلى عناصر معاينات البنيات، والعناوين البيضاء فوق الأبيض، والتباين الضعيف في Providers وCollections.
- F10 (جزئي): أزيل عمود الفراغ الوهمي من معرض البنيات، وجُمعت عناصر التحكم في صفوف متجاوبة، وعُرضت البطاقات في شبكة كاملة العرض. أُصلح ضغط مقدمة الصفحة عند 398px دون overflow أفقي؛ تبقى مراجعة جميع الصفحات والمقاسات والحالات.

- كل رسالة جديدة: أضف المتطلبات أو حدّثها هنا أولاً، ثم اربطها بمهمة في `todo.md` وبترتيب التنفيذ في `plan.md`.
- الطلب الأحدث ينسخ القرار القديم المتعارض فقط، وليس بقية الخطة. احتفظ بسبب الاستبدال.
- الحالات: **مفتوح**، **جزئي** (كود/اختبار محدود)، **متحقق** (دليل يغطي كامل البند)، **مستبدل**. لا تعني الاختبارات الخضراء جاهزية المنتج.
- قبل إنهاء كل حزمة: حدّث أدلتها وحالتها، والمتبقي؛ لا تبدأ مهمة تجميل سهلة لمجرد تجنب متطلب أساسي أصعب.
- العرض الأصلي على Windows، المتصفح، الصور المولدة، واختبارات الوحدات أنواع أدلة مختلفة ولا تُستبدل ببعضها.
- لا تغيّر Personal أو الحسابات الحقيقية أو إعدادات الأمان. بيانات التجربة معلّمة بوضوح ولا توهم بتسجيل دخول حقيقي. لا نشر أو تثبيت إنتاجي تلقائي.

## القرارات المصححة / المستبدلة

- اقتصار المنتج على ثيم واحد كان مرحلة تأسيس؛ المستخدم طلب لاحقاً عدة بنيات وطرق عرض ومواضع وستايلات. يبقى شعار رسمي وثيم افتراضي واضح، لا حذف للتنوع المطلوب.
- «الثيم خامات/ألوان فقط» **غير مقبول** بوصفه النتيجة النهائية. الثيم هو هوية: خامات، ألوان، خطوط، حواف، زخرفة، تفاصيل الشكل وحركة مضبوطة. يسمح بتغييرات شكلية ضمن عقد البنية والتكيف، دون تغيير بيانات الاستخدام أو كسر السحب ومساحات النقر.
- «نافذة واحدة دائماً» لا يلغي طلب عناصر مستقلة قابلة للفصل والتجميع. اختيار التنفيذ يخضع لاختبار الموارد وإدخال الماوس.
- `all/session/weekly/both/none` والقوائم الجاهزة حل انتقالي **مرفوض كواجهة نهائية**. المطلوب عناصر فعلية متعددة الاختيار قابلة للترتيب.
- «كالساعة» يعني تنقل/دوران المزودين وليس رسماً حرفياً لساعة. لا مدار كبير فارغ ولا استحواذ على سطح المكتب.

## A — الهوية والشعار

| ID | المتطلب | الحالة / دليل القبول المطلوب |
|---|---|---|
| A01 | شعار About الفضي هو الأصل الرسمي، نفس شكل المرجع الأخير | جزئي قوي: واجهات React وPNG/ICO/الإشعارات ومولد Tray مشتقة من `quotaarc-void-mark.svg`؛ بقي الجرد الأصلي النهائي |
| A02 | توحيده في الترويسة، About، النوافذ، taskbar، tray، الإشعارات، الاختصارات، exe، المثبت والتحديث/الإزالة | جزئي قوي: أصول Windows والحزمة والإشعار موحدة؛ بقيت لقطات Windows ومثبت فعلي |
| A03 | حدود فضية لامعة واضحة، دون هالة داكنة تطمس الرمز؛ تكبير افتراضي مع حجم يختاره المستخدم | جزئي قوي: موارد 16–512px وحجم 90/100/116% محفوظ؛ بقي فحص 75–200%DPI الأصلي |
| A04 | نسخة مقروءة للشعار لكل ثيم/نهاري/داكن، نفس هوية About وليس شعارات عشوائية | جزئي قوي: Silver/Arctic/Aurora/Ember/Violet بنفس الشكل؛ بقيت مصفوفة التباين الأصلية |
| A05 | إزالة ظهور الهوية القديمة من واجهة المنتج/أيقوناته/الحزم/التاريخ المعروض | جزئي؛ لا تمس سجل Git أو إسناد الترخيص القانوني؛ افحص أسماء exe/installer والواجهات |

## B — عقد العرض: بنية × طريقة عرض × موضع × هوية

| ID | المتطلب | الحالة / دليل القبول المطلوب |
|---|---|---|
| B01 | فصل البنية عن طريقة العرض وعن الموضع وعن الستايل والثيم وألوان المزودين | جزئي؛ مخطط typed ومهاجرة إعدادات، لا تعدد تطبيقات لنفس المنطق |
| B02 | بنيات مميزة فعلاً، لا أسماء لألوان أو اتجاهات الشكل نفسه | مفتوح؛ تقييم silhouettes ووظيفة كل بنية |
| B03 | إعادة تصميم الست القديمة بمستوى التصاميم الجديدة | مفتوح؛ Flowline/Reel/Horizon/Petal/Orbital/Lens مقارنة مرجعية وحية |
| B04 | خمس بنيات إضافية إبداعية ثم أربع بنيات صغيرة، فضلاً عن التنوع السابق | مفتوح: الأعداد لا تُحسب بمجرد عدد خيارات catalog؛ جرد أصل كل بنية ومعايير تميّزها |
| B05 | أحجام صغيرة، تكبير/تصغير لكل بنية، معاينة الأبعاد الحقيقية والمساحة المشغولة أثناء التخصيص | جزئي قوي: scale موجود وبطاقات البنيات تعرض footprint منطقي حقيقي؛ الأبعاد الحية بعد جميع تخصيصات الحدود/المحتوى ما زالت مفتوحة |
| B06 | كل طرق العرض العامة متاحة لجميع البنيات، واستثناءات ضرورية موثقة فقط، مع طرق خاصة للبنية | مفتوح: مصفوفة دعم لا خيارات وهمية |
| B07 | كل الحواف والأعلى/الأسفل والزوايا والمكان الحر؛ تحول تلقائي مناسب عند الاقتراب | جزئي قوي: 14 بنية × 9 مواضع مغطاة فعلياً ضمن مصفوفة 2,268 renderer case، وإصلاحات زاوية Flowline/Horizon وفحص بصري لاتجاهين متعاكسين؛ تبقى مصفوفة native عبر الشاشات وDPI/taskbar |
| B08 | سحب سلس بالفأرة، snap حقيقي، محاذاة صحيحة، إفلات/إلغاء/فقد الشاشة | جزئي قوي: Win32 WM_MOVING magnetism حيّ ومقاس حسب DPI للحواف الأربع والزوايا، مع commit/clamp بعد الإفلات واختبارات 425 Windows؛ قبول فأرة أصلي مازال مفتوحاً لأن computer-use لا يعرض تطبيق Windows |
| B09 | عدم حجب العمل أو سرقة التركيز/النقر؛ حدود النافذة تطابق الرسم | مفتوح: hit-test/transparent area/overlap/always-on-top/fullscreen |
| B10 | جميع الحواف ناعمة، دقة الوصلات والمسارات والنصوص والأسماء، لا فراغ زخرفي ضخم | مفتوح: لقطات حجم فعلي لكل حالة |
| B11 | hover يعرض معلومات العنصر نفسه، لا يبدل المزود؛ wheel وحده يبدل القائمة حيث مختار | جزئي قوي: المضيف المشترك يفعّل hover والتحديد الموضعي وwheel لكل البنيات، مع منع ازدواج العجلة في Notch/Reel؛ بقي قبول الفأرة الأصلي الكامل |
| B12 | بعد خروج الماوس نحو500ms ينطوي إلى مزود واحد ثم يلتصق فعلياً بالحد؛ خيارات تشغيل/إلغاء وتوقيت لكل البنيات | جزئي قوي: طيّ التفاصيل منفصل عن الإخفاء، مؤقته محفوظ وقابل للتعطيل ويعمل للبنيات العامة مع مؤقت provider-level مستقل لـNotch؛ بقي فحص footprint أصلي لكل بنية |
| B13 | الضغط يفتح تفاصيل usages؛ hover معلومات؛ إمكانية تثبيت التفاصيل وإغلاق/Escape وكيبورد | جزئي؛ مصفوفة جميع البنيات |
| B14 | تسلسل حالات compact/hover/focus/expanded/collapse/hidden/pinned واضح ومشترك | جزئي؛ تسجيل حركة وحدود بلا قفزات |

## C — Collections / عناصر مستقلة

| ID | المتطلب | الحالة / دليل القبول المطلوب |
|---|---|---|
| C01 | كل مزود عنصر مستقل يُسحب من حاوية إلى أي مكان | جزئي قوي (2026-09-07): السحب/الفصل/الضم يعمل في محرر Settings (`CollectionsStudio.tsx`)؛ نافذة `collections` الأصلية تعرض النتيجة المحفوظة حيّة لكنها للقراءة فقط، والسحب من النافذة الأصلية نفسها ما زال مفتوحاً — راجع `docs/validation/COLLECTIONS_0_10_1.md` |
| C02 | الحاوية تعرض3، wheel لبقية العناصر؛ تنكمش لـ2/1 وتختفي عند0 | جزئي؛ 0/1/2/3/6/12 عنصر (لم يتغير هذه الجولة) |
| C03 | إسقاط عنصر فوق آخر ينشئ مجموعة، ضم/فصل/إعادة ترتيب مرنة | جزئي قوي: منطق الضم/الفصل/الترتيب (`collectionModel.ts`) مختبر بالكامل ويعمل في المحرر والنافذة الأصلية معاً |
| C04 | تجميع مربع/أفقي/عمودي وغيرها، وطرق عرض خاصة متكيفة | جزئي قوي: 3 طرق عرض (أفقي/عمودي/شبكة) تعمل في المحرر والنافذة الأصلية؛ طرق إضافية متكيفة تبقى مفتوحة |
| C05 | expand بالنقر، hover لتفاصيل مزود، كل عنصر يلتصق بحد مناسب | جزئي: النقر لعرض التفاصيل يعمل في النافذة الأصلية؛ الالتصاق بحد الشاشة/قبول native الكامل مفتوح |
| C06 | حفظ مواضع/مجموعات بعد إعادة التشغيل مع استعادة آمنة عند تغير الشاشات | جزئي قوي (2026-09-07): تحقق فعلي — حفظ عبر `set_collection_layout`، بقاء البيانات بعد إعادة تشغيل حقيقية للتطبيق، واستعادة آمنة عند فقد الشاشة (`resolve_geometry`/`clamps_a_stored_position_that_is_now_off_the_work_area`، اختبار حقيقي وليس افتراضاً)؛ الفصل النافذة الأصلية المستقلة **لكل مجموعة على حدة** (بدل نافذة واحدة تعرض الكل) يبقى مفتوحاً |

## D — Usage / اختيار وترتيب وتقديم الحدود (تصحيح المستخدم الأخير)

| ID | المتطلب | الحالة / دليل القبول المطلوب |
|---|---|---|
| D01 | اختيار أي تتبع متاح بعلامة صح مستقلة، لا presets؛ جلسة/5h/أسبوعي/نماذج/إضافي وغيرها | مفتوح: `providerDetailWindows` الحالي غير كافٍ ويُهاجر |
| D02 | ترتيب مختارات كل مزود بحرية، مع keyboard بديل للسحب، دون تغيير الآخرين | مفتوح: stable window IDs، reorder round-trip |
| D03 | لكل حد: bar فقط، bar+percentage، percentage فقط | مفتوح: رسم ونص a11y متوافقان |
| D04 | أشكال مؤشرات: دائري/أفقي/عمودي وبدائل مبررة | مفتوح؛ لا يخلطها مع بنية نافذة التطبيق |
| D05 | إظهار حدين في الوقت نفسه في المؤشر الدائري؛ wheel يصفح البقية يمين/يسار | مفتوح: 0/1/2/3/6 حدود بلا duplicate/skip |
| D06 | اتجاه المؤشر الأفقي/العمودي قابل للاختيار (يمين/يسار، أعلى/أسفل) | مفتوح: اتجاه تعبئة مستقل عن RTL واتجاه ترتيب العناصر |
| D07 | reset/countdown لكل حد، المتاح/banked إن المصدر يقدمه؛ لا اختراع بيانات | جزئي: نوافذ مستقلة؛ مصدر/قدم/غيرمتاح يحتاج مراجعة |
| D08 | used/remaining/hybrid عالمي ومخصص لكل مزود/حساب مع تنسيق أرقام صحيح | جزئي: pure pipeline واختبارات موجودة؛ إثبات6حالات native ناقص |
| D09 | معاينة فورية للإضافة/الحذف/الترتيب/الشكل والحجم قبل التطبيق، مع حفظ/إلغاء/فشل واضح | جزئي: preview محدود؛ شامل الخيارات الجديدة مفتوح |
| D10 | بيانات وهمية5–6مزودين للاختبار فقط، Claude/Gemini وغيرهم؛ خروج آمن من demo | جزئي: fixtures موجودة؛ لا تزوير تسجيل دخول |
| D11 | إعدادات مصادقة واضحة وزر OAuth/تسجيل دخول حيث يدعمه المزود فعلاً | جزئي قوي (تدقيق 2026-09-07، `docs/validation/OAUTH_AUTH_UX_AUDIT_0_10_1.md`): نظام حالة اتصال حي (`ProviderSidebarStatus`: ok/stale/error/disabled/loading) موطّن بالكامل مع نص سبب واضح لكل حالة، ولا تسريب أسرار في السجلات؛ لم يُكتشف خلل فعلي محدد. التحقق الحي لكل تدفق OAuth فعلي يبقى UNVERIFIED لا PASS |

## E — الثيمات والمراجع

| ID | المتطلب | الحالة / دليل القبول المطلوب |
|---|---|---|
| E01 | مراجعة المكتبات الأربع: 15-Legendary-v2، Theme-Library،50-Themes ZIP،Downloads/Themes | جزئي: جرد4مسارات؛ صور مختارة فقط؛ بقية المراجعة مفتوحة |
| E02 | تقييم الصور كبنية وثيم مدمجين، اختيار الأفضل بأسباب، توليد ثم تنفيذ ثم مقارنة | جزئي: لوحة واحدة؛ جرد وتقييم شامل ناقص |
| E03 | هوية كاملة: حواف/زخرفة/خطوط/خامات/حركة/تفاصيل شكل، لا مجرد provider palettes | جزئي قوي: 9 هويات حية لها signature/inlay/meter/connector/mark/font/material/motion ووتيرة 150–230ms مميزة، مع لوحة مقارنة فعلية وخصائص Frame/Meter/Motion ظاهرة؛ القبول المرجعي النهائي مفتوح |
| E04 | جميع الهويات تتكيف مع جميع البنيات/طرق العرض/المواضع؛ deform محدود آمن | جزئي قوي: tokens مشتركة paint-only واختبار React ناجح لـ2,268 تركيبة (9 ثيمات × 14 بنية × 9 مواضع × compact/expanded) مع فحوص بصرية متقابلة؛ قبول الحركة الأصلية الكامل مازال مفتوحاً |
| E05 | صور/معاينات ملونة واضحة لكل بنية/ستايل/طريقة/موضع وخيار بصري، وحركة قصيرة عند الحاجة | جزئي: معاينات فعلية للبنيات والثيمات والتنقل فقط |
| E06 | مراجعة مستودعات notchy/notchi الثلاثة وcodenotch الصور/MP4 ودقة الحركات | جزئي: لا ادعاء نقل كود Windows؛ راجع الترخيص والتوافق قبل إعادة الاستخدام |
| E07 | ثيم افتراضي رسمي متقن، هوية سوداء/فضية؛ تنوع مختار لا فوضى | مفتوح قبول بصري |
| E08 | طبقة مستقلة لهوية عرض المزودات: لوحات/خطوط/ألوان/مسارات/حلقات وقيم، اختيار عام أو لكل مزود، وتبقى واضحة فوق كل ثيم ستراكشر | جزئي قوي: صفحة مستقلة لا تختلط بثيم التطبيق أو الستراكشر، 24 هوية حية منها 6 نهارية، تحكم عام ولكل مزود في الهوية/الشكل/المحتوى/الاتجاه/اللون مع معاينة تطابق الاختيار الفعلي، وطبقة تباين دلالية AA للنص والمسار وحالات التحذير/الحرج/النفاد عبر مصفوفة الثيمات؛ بقي فحص DPI الأصلي الشامل لكل pairing |

## F — التطبيق كاملاً / الإعدادات / اللغة

| ID | المتطلب | الحالة / دليل القبول المطلوب |
|---|---|---|
| F01 | إعادة تصميم جميع الصفحات لا Surfaces فقط | جزئي قوي: General/Notifications/Advanced تستفيد من عرض متكيف، وSurfaces تملك gallery حقيقية وطبقة تحكم منظمة بقيم حية؛ بقية الصفحات وtray/dashboard/popout ضمن الجرد النهائي |
| F02 | تصنيف user-friendly: إعدادات التطبيق/لغة/مظهر منفصلة عن سطح العرض والبيانات | جزئي قوي: Provider Display صفحة مستقلة تجمع الهوية وطريقة limit واللون وقواعد كل مزود، بينما Themes وSurfaces وUsage & Spend عادت لمسؤولياتها المنفصلة؛ جرد بقية التصنيف مفتوح |
| F03 | شرح بسيط تحت كل خيار، وضوح labels/حالاتالحفظ/تعطيل/أخطاء/empty/loading | جزئي قوي: مواضع الملاحة وSurfaces interactions تشرح الخيارات مباشرة، بما فيها سبب عدم التوفر وقيم ranges الحية؛ جرد بقية الصفحات مفتوح |
| F04 | العربية كاملة باستثناء الأسماء الصحيحة؛ RTL،sidebarيمين،LTRداخلالأسماءوالأرقام | جزئي؛ محرر الحدود/المؤشرات والملاحة وأسماء الوصول عُرّبت، 923 مفتاحاً متطابقاً؛ ما زالت مصفوفة الصفحات العربية الكاملة مطلوبة |
| F05 | نهاري/داكن/نظام للتطبيق مستقل عن ثيم widgets | جزئي قوي: shell+notification في dark/light عبر 1440px و398px؛ جميع الصفحات لم تُفحص بعد |
| F06 | تكبير/تصغير/سحب حواف/fullscreen/Snap؛ لا تصغر النافذة عند تبديل الصفحات | جزئي قوي: نافذة Settings المنفصلة تحفظ الحجم/الموضع وتخفي عند الإغلاق؛ تغيير التبويب لا يرسل انتقالاً أصلياً عندما تكون الإعدادات مالكة للسطح وsame-mode retarget لا يعيد show لنافذة ظاهرة؛ مصفوفة native لكل الصفحات لازمة |
| F07 | تنقل جانبي افتراضي، اختيارside/top/bottomمنGeneral معمعاينات وحفظ | جزئي قوي: ثلاث بطاقات معاينة مترجمة + حفظ وكود/اختبار ومتصفح فعلي لكل side/top/bottom؛ قبول native ما زال مفتوحاً |
| F08 | توحيد الأيقونات والمقاسات والزرار/dropdowns،لا قص نص/تمرير غيرضروري | جزئي قوي: أصلح قص NotificationPreview وأسماء tabs، ووحّد صفوف switches/ranges/demo/size في Surfaces؛ جرد بقية الصفحات/الأحجام مفتوح |

## G — الإشعارات والمزامنة

| ID | المتطلب | الحالة / دليل القبول المطلوب |
|---|---|---|
| G01 | مزامنة دقيقة دائمة، stale/offline/error صريحة؛ لا استنتاج reset من عينة فاسدة | جزئي؛ trace replay + network failure |
| G02 | تحذيرات remaining20/10/0 و50%/منتصف أسبوعي، منفصلة لكل حد5h/weekly | جزئي قوي (تحقق 2026-09-07): عتبتا high/critical مستقلتان فعلاً لكل مزود ولكل نافذة (session/fiveHour/weekly) عبر سلسلة وراثة مختبرة (نافذة→مزود→عام) وواجهة إعدادات فعلية (`GeneralTab.tsx`'s notification-overrides، مختبرة في `GeneralTab.test.tsx`)؛ لم يكن هذا مفتوحاً كما ظنّ `CODEX_UNFINISHED_WORK.md` سابقاً — صُحح هناك. القوالب الكاملة (50%/منتصف أسبوعي تحديداً) تبقى مفتوحة |
| G03 | نسب اعتباطية وخطوات كل5%/10% أو يحددها المستخدم، وتمكين مستقل للأحداث | جزئي قوي: تمكين مستقل لست فئات + predictive؛ فاصل مراحل حر 1–100% مع baseline وعبور ودعم reset؛ dedupe دائم ومحدود الحجم عبر إعادة تشغيل التطبيق دون حفظ هوية الحساب الخام |
| G04 | resetمتوقع/مبكرغيرمتوقع، session/weekly/both، bankedreset حيثمتاح | جزئي قوي: Expected/Unexpected لكل نافذة فعلية مع timestamp/drop/jitter/stale guards وتمكين مستقل؛ Banked Reset Credit منفصل من عداد Codex الحقيقي؛ جميعها ضمن dedupe الدائم |
| G05 | used/remainingلايغيرمعنىالحدث؛ حساب/مزود/حدمحدد؛ لاتكرارعلىrestart/refresh | جزئي قوي: dedupe دائم لكل حساب/مزود/حد وpredictive عبر restart/refresh ببصمات دون هوية خام؛ مصفوفة used/remaining replay الكاملة مفتوحة |
| G06 | شعارالتطبيق + أيقونةالمزود،نصيبينالحدوالسبب،ألوانخطورة وتدرج؛دخول/خروجسلسلاتسرقالتركيز | جزئي قوي: معاينة فعلية مدمجة تحمل الشعار الرسمي وأيقونة المزود وشريطاً دلالياً ونصي used/remaining معاً، وفحص browser داكن/نهاري عند 398px؛ محتوى toast الأصلي يحدد المزود والحد والسبب والنسبتين ويترجمها للعربية؛ شكل وحركة Windows Toast الأصلية ما زالا مفتوحين |
| G07 | خياراتصوت/تعطيل/اختبار/معاينة/quietمناسبة؛ ليستكلالإشعاراتمفعلةافتراضياً | جزئي قوي: تعطيل عام وفئوي + صوت ومعاينة semantic مدمجة داكن/نهاري؛ لوحة فئات موحدة كثيفة بلا hover movement؛ ملفات WAV واختبار مستقل لأحداث scheduled/unexpected/banked reset؛ ساعات هدوء محلية محفوظة تدعم الليل واليوم الكامل دون إيقاف المزامنة أو replay؛ اختبار native بصري مفتوح |

## H — الأداء والجودة والنشر

| ID | المتطلب | الحالة / دليل القبول المطلوب |
|---|---|---|
| H01 | قليلCPU/GPU/ذاكرةوهوشغالدوماً؛مقارنةhidden/V5/V8/الجديدبعدالاستقرارلابدايةالتشغيل | مفتوح: قياسشجرةWebViewكاملة،rAF/CSS/timers،وقتالتوسع والسحب |
| H02 | reduced-motion،توقفالحركةخارجالعرض،لاloopزخرفيدائم؛سلاسةوحجمصغير | جزئي؛ performance capture |
| H03 | startupاختياري،singleinstance،تعطيل،استعادةبعدrestart | مفتوح تجربةWindows |
| H04 | مثبتاحترافيبهويتهوحالاتinstall/update/repair/uninstall/rollbackوتوقيع | مفتوح؛ لا نشر قبل قبول |
| H05 | مصفوفةDPI100/125/150/200%،1080p/1440p/4K،شاشاتمتعددة/taskbar | مفتوح، موثّق بالتفصيل 2026-09-07 في `docs/validation/native-0.10.1/NATIVE_DPI_MATRIX.md` وMULTI_MONITOR_MATRIX.md: 150% فقط متاح فعلياً على هذا الجهاز (شاشة واحدة)؛ البقية عائق بيئة/عتاد صريح لا يُحل من هذه الجلسة |
| H06 | native7themesحالاتcompact/hover/focus/expanded/collapse،حركة،15reference-vs-production sheets | مفتوح؛ أعدادالتسليماتالسابقةلمتُلغ |
| H07 | اختباراتfrontend/backend/shell+build/tsc/fmt/clippy/secret scanبأعدادغيرمتداخلة | جزئي قوي: frontend 110 files/568، core 1468، Windows 425، locale 923، production build ناجح؛ tray timing نجح 5× منفرداً ثم ضمن full suite تحت حمل build، وsecret scan والقبول البصري الكامل مفتوحان |
| H08 | كللقطةمربوطةexe/PID/mtime/revision/settings/datafixture،لا stalebinaryPASS | جزئي: النسخة الأصلية الحالية PID75196، mtime 2026-09-06 14:36:21، SHA256 02A932EBB87024C2D8D2256EEC6196BEAEAE180D29D2DC89D2737CAF4EEAD641؛ إثبات Providers الضيق موثق بالمتصفح مستخدماً كلاسات الإنتاج، ولقطة native مرتبطة بالfixture والإعدادات ما زالت مفتوحة |
| H09 | اختبارالبرنامجالأصليبالأدواتالمسموحة؛عدمتحايلعلىAccessdenied | غيرمتحقق، مؤكَّد فعلياً 2026-09-07: جُرِّب `SendKeys` حقيقياً عبر PowerShell على نافذة Settings الأصلية، وتحقّقنا عبر `document.activeElement` أن التركيز لم ينتقل فعلياً — الجلسة لا تملك إدخال Windows تفاعلي حقيقي. موثّق في `NATIVE_INPUT_MATRIX.md`؛ لا يمنع بقية الكود |
| H10 | كلطلبموجودفيالسجل،كلتعديلجديدمضاف،لاادعاءجاهزيةحتىمطابقةجميعالبنود | هذاالسجلتأسيس؛ auditنهائيبعدالتنفيذ |

## تدقيق الأرشيف — 2026-09-07 (Claude، نطاق محدود)

بالطلب: مراجعة G4/A01–H10 القديمة *بعد* إنجاز الأطوار A–D لهذه الموجة، لا
استبدال شامل. تم تحديث فقط الصفوف التي تحقق منها هذا الجلسة فعلياً ولها دليل
جديد: C01، C03–C06 (نافذة Collections الأصلية)، G02 وD11 (تدقيق الإشعارات
والمصادقة)، وH05/H09 (مصفوفة DPI/الإدخال الأصلي). بقية الصفوف (A، معظم B،
D01–D10، E، معظم F، G01/G03–G07، H01–H04/H06–H08/H10) **لم تُراجع** هذه
الجولة — حالتها كما وثّقها آخر من عمل عليها، وليست مؤكدة أو مرفوضة من هذه
الجلسة. لا تُقرأ "لم تُراجع" على أنها "منجزة" أو "ملغاة".

## I — Dashboard Studio (2026-09-07، جلسة Claude — طلب جديد، سجل ابتدائي)

طلب موسّع جديد من المالك: تحويل Dashboard إلى مركز قيادة حقيقي بثلاثة أوضاع
(2D Analytics / 3D Providers / Hybrid) يختارها المستخدم من Settings، مع سجل
أنواع Dashboard قابل للتوسعة، تحميل/تفريغ واحد فقط نشط في كل مرة، ثيمات بنية
منقّحة (Obsidian/Aged Silver/Antique Gold/...)، استقلال Provider Presentation
عن Structure Theme (نظام قائم بالفعل — انظر E08 أعلاه)، نظام دقة تسعير محلي
موثّق المصدر، تحليلات تاريخية حقيقية بلا أرقام مختلقة، تنظيف عرض أخطاء
المزودات الخام، تخصيص layout/كثافة محلي بالكامل، أداء مقاس (Low CPU/Balanced/
High Fidelity)، RTL/إتاحة، وإثبات native. قيد صريح: لا حساب/اشتراك/دفع/سحابة
مملوكة لـQuotaArc — محلي بالكامل.

- I01 (مفتوح): سجل Dashboard Studio المُكتَّب (`DashboardDefinition`) + إعدادات
  اختيار الوضع محليًا + تحميل كسول/تفريغ الموارد عند التبديل.
- I02 (مفتوح): 2D Analytics Dashboard — بنية معلومات ثم تحسين بصري ثم حركة،
  بيانات حقيقية فقط (`—` بدل الأرقام المختلقة).
- I03 (مفتوح): تدقيق وتوثيق مصادر التسعير الحالية قبل أي تعديل —
  `docs/validation/PRICING_DATA_AUDIT.md` (لم يُنشأ بعد).
- I04 (مفتوح): محرك 3D — نموذج أولي أداء أولاً (3 مزودين)، ثم إنتاج كامل مع
  تفريغ موارد مثبت بلا تسريب عبر تبديل 2D↔3D↔2D متكرر.
- I05 (مفتوح): Hybrid — تركيب مقصود لا تحميل الكل معاً.
- I06 (مفتوح): تنظيف عرض أخطاء المزودات الخام على Dashboard (بطاقة ودّية +
  "عرض التفاصيل التقنية" بدل فقرة backend خام).
- I07 (مفتوح): تخصيص layout/كثافة/ودجات محلي، بلا خدمة سحابية.
- I08 (منجز جزئياً هذه الجلسة — انظر `docs/validation/DASHBOARD_MASTER_AUDIT.md`):
  تدقيق الحالة الحالية (2025-09-07 Claude) — لا widget registry/3D dependency
  موجودة سابقاً؛ راجع ملف التدقيق للتفاصيل الكاملة بدلائل file:line.

هذا القسم تأسيسي فقط لهذه الموجة الضخمة (13 مرحلة مطلوبة من المالك) — لا يُقرأ
أي بند أعلاه كمنجز حتى يُربط بدليل قبول native صريح، تماماً كبقية هذا السجل.

## J — Single Analytics Dashboard (2026-09-09)

Owner consolidation request supersedes I01/I04/I05's multi-mode direction.
- J01: One Dashboard; retire 3D/Spatial/Hybrid selectors, engines, routes and dependencies.
- J02: Legacy persisted modes resolve safely to Analytics without destructive file migration.
- J03: Preserve deterministic user Demo Mode, snapshot truth and Spend/Balance/Credits distinctions.
- J04: Limits and resets first; compact themed DOM/SVG observatory analytics, RTL and responsive.
- J05: Fresh complete quality gates, native Dev screenshots and performance/bundle measurements.
- J06: Personal untouched; retain historical docs; stop after acceptance, no new mode.

J01–J06 implemented and verified on 2026-09-09 at code revision `c90b12a7`.
Evidence: `docs/validation/DASHBOARD_CONSOLIDATION.md` and native captures in
`docs/images/dashboard/final/`. Engineering verdict: FINAL DASHBOARD PASS;
owner visual approval is not implied. No next visual mode or Personal promotion.

## الإحالات والأدلة القائمة

`REFERENCE_SELECTION_2026-09-06.md`، `DETAIL_VISIBILITY_2026-09-06.md`، `APP_APPEARANCE_2026-09-06.md`، `COLLECTIONS_PRODUCT_PLAN.md`، `THEME_RUNTIME_RECOVERY.md` مستندات أدلة تاريخية؛ لا تحول كلمة completed قديمة إلى قبول جديد.

آخر صور المستخدم: `codex-clipboard-e5541ed3-d775-4ddc-b0fd-35337db2c61f.png` شعار About؛ `28d8968f-b1d5-4ab1-8fe3-32f73385fb8b` يرفض قائمة presets؛ `932bcc03-a95a-48ac-be9a-a68f67f0528d` يرفض palette-only/gallery؛ `bf6b60bf-41bf-4410-94ed-ee5133ce7e16` يثبت ضعف reveal icon. المسارات الكاملة ضمن رسالة المستخدم الأخيرة في Temp.

## K — Professional product upgrade (2026-09-09)

Owner master upgrade extends J; one Analytics Dashboard remains mandatory.
- K01: Evidence-first architecture audit, implementation phases and honest remaining scope.
- K02: Grouped product navigation and centralized, live settings propagation.
- K03: Reusable premium Providers list/detail template with explicit operational states.
- K04: Audit every provider auth entrypoint; fix supported connect/reconnect/account flows, never invent support.
- K05: Audit analytics units, scope, currency, aggregation, freshness and unavailable semantics; fail closed.
- K06: Upgrade readable chart/table/card templates and useful observability.
- K07: Unify purposeful customization across relevant surfaces.
- K08: Configurable Demo in Dashboard and Providers, isolated from live credentials/data.
- K09: Coherent commits, tests/builds, native Dev proof, final validation; Personal untouched.

K01–K09: scoped implementation and engineering validation completed on 2026-09-09
at implementation revision `17c99c02`. Evidence and explicit external-auth/profile
limitations: `docs/validation/PRODUCT_UPGRADE_VALIDATION.md`. No claim of 70 live
authenticated providers, owner visual approval, or Personal promotion.

## L — Major Product Evolution V2 (2026-09-09)

Owner accepts K and requests a second structural evolution from clean `6fbe7a6b`.
- L01: Fresh architecture audit, controlled waves and coherent commits.
- L02: Five primary destinations, Workspace shell and searchable Settings Center; preserve legacy links.
- L03: Central customization metadata, safe section resets, persisted Dashboard layout/style/templates and live propagation.
- L04: Authoritative metric registry, availability/comparison/velocity contracts and invariant corpus.
- L05: Dashboard V2 analytical templates, multi-window limits, attention, reset horizon, sortable comparison and quality.
- L06: Provider Operations V2, explicit auth capabilities, prominent supported actions and cancellable bounded login.
- L07: Central Demo controls, deterministic scenarios, no live data/credential mutations from Demo.
- L08: English/Arabic, accessible and responsive surfaces, measured large-history behavior, no idle polling regression.
- L09: Native Dev evidence board and full gates; final 31-item report. Personal untouched; no 3D/Spatial/Hybrid.

Pending. Architecture and wave acceptance: `docs/validation/QUOTALIS_PRODUCT_ARCHITECTURE_V2_AUDIT.md`.


## L10 — Owner navigation correction — 2026-09-09
Replace the duplicate in-content Settings category column with expandable/collapsible subnavigation directly beneath Settings in the primary sidebar. Expose existing useful destinations, retain clear grouping, and repair wasted width and settings card layout. No additional dropdown selector. Preserve ongoing V2 correctness and validation obligations.


## L11 — Analytics Waves 2–4 continuation — 2026-09-09
Settings/IA L10 accepted. Freeze navigation except regressions. Complete exhaustive source-backed metric audit and typed registry, truthful shared analytics, current limits/templates, ranked attention, period comparisons/velocity (projection fails closed), Reset Horizon, comparison, coverage/freshness/quality, chart/table semantics, customization/invariants/performance corpus and real Dev screenshots. Six-provider Demo showcase plus separate real data. Stop at Dashboard V2 visual review; do not begin another Providers redesign. Full request: attachment a11693e1-564c-4a2e-8893-9593eaca8af4/pasted-text.txt.

## L12 — Wave 4.5 professional analytics presentation
Owner accepts Wave 4 truth, rejects visual presentation. Adopt an audited modular chart platform, one view model/spec/theme boundary, compact limits, advanced trend/comparison/heatmap/table templates, native review cycles, accessibility and measured lifecycle/performance. Keep Personal untouched and stop before Providers redesign. Source: attachment 6e81bf11-f2b9-48fc-ac63-afe52477426d.

Engineering/evidence completed; owner visual acceptance pending. See `docs/validation/ANALYTICS_V3_VALIDATION.md` and the Analytics V3 review board. This checkpoint does not accept the rejected V2 visuals or authorize the next Providers wave.

## L13 — Analytics V4 visual-first reconstruction — 2026-09-10
Owner rejects V3 presentation while preserving its truthful analytical architecture. Capture/audit native baseline, generate four concepts and controls sheet, score and select a master, generate final component/RTL/narrow targets and write the design contract BEFORE production Dashboard edits. Implement professional controls, editorial hierarchy, progressive disclosure, compact limits, comparison answers, reset rail and concise quality. Require three native concept-to-code comparison cycles, all engineering gates and final readable review boards. No Personal, Providers redesign or 3D. Source: attachment dfb5031f-2299-440b-9016-110bac6bf254/pasted-text.txt. Owner selection need not block execution.

### L13 visual steering — generated concepts A/B rejected
Owner requests richer/better colors and an explicitly cosmic, planetary, stellar identity, with every provider's logo present. Rework concepts before implementation. This updates the muted workstation art direction, not the metric contracts; retain 2D/no-WebGL and readable efficient analytics. A/B remain archived as rejected explorations, not implementation targets.

### L13 master direction selected by owner
Owner explicitly selected the cosmic image (`CONCEPT_A_COSMIC_REVISED.png`, also attached as codex-clipboard-11213fea-eb20-4149-880e-a33f6e224286.png). Adopt this visual direction; no further competing-direction selection is needed. Preserve the ORIGINAL Quotalis logo exactly, and original bundled provider logos. Generated replacement branding, invented slogans, macOS window dots and semantically invented heatmap colors are excluded. Complete component/control/RTL/narrow specifications, implement the selected direction, and retain the V4 native fidelity and correctness gates.

### L13 immediate implementation correction
Owner rejected subsequent component concept sheets and explicitly instructed implementation of the selected image (re-attached as codex-clipboard-d4d6c0b7-2b2e-4808-b787-9587de8e1349.png). Stop alternative UI concept generation. The selected image itself is the component/layout contract: six planetary provider instruments on an orbit, compact status ribbon, Attention/Trend/Reset editorial row, lower matrix and quality. Produce actual code and native evidence. Decorative background asset extraction is implementation work, not another design proposal. Original logo geometry and truthful runtime data remain mandatory.

## PRODUCT-V3 — owner operational / analytics separation (2026-09-10)
Starting clean HEAD: 4f3e493e2150f813e96181460e05be63d6b46f1f.
Source: owner Product V3 spec and ten screenshots. Owner rejects current product experience.
Acceptance: nested Dashboard Overview/Analytics; clickable windowed provider rail with wheel/drag/keyboard and detected plans, scale1/6/12/24/40/70; remove meaningless ellipse; rich capability-gated global/provider analytics; Providers operations upgrade; shared accessible select/multiselect; native notification branding/icon/deep-link audit and repair; shared theme/RTL/responsive surfaces; native evidence and truthful full gates. Personal untouched, no WebGL, no fake metrics. Design concepts precede production UI. Implementation waves and incomplete proof stay explicit.

## POST-RELEASE-01 — forensic continuation (2026-09-12)
Source: owner attachment 62c69d2e-5740-4fa1-b453-f72ec3089110.
Continue from latest source 0f108437, preserving accepted application dfd81974,
installer-only 1b3a6db3 and installed stable Personal 0.11.0 as distinct identities.
Reconcile release/rollback evidence, run current source gates and a freshly verified
Dev native smoke, inventory real open work, then complete one evidence-backed
hardening slice. Personal is frozen: no install, settings/data/shortcut/pin changes.
Closed Analytics acceptance and historical incidents remain intact; no speculative
reopening, fake sessions, monetary conversions, cloud or 3D. Checkpoint and exact
verification results: docs/validation/CODEX_POST_RELEASE_HANDOFF.md.

## SHELL-01 — Compact workspace and adjustable navigation (2026-09-12)

Owner annotated screenshot 56582426 requests compact application/context/category
headers across pages, especially Settings; a top logical-start collapse/expand
button (left English, right Arabic); draggable sidebar width; and larger, clearer
Dashboard/Workspace/Settings branch controls. Persist presentation preferences,
preserve logos and data, keep keyboard access and RTL, and validate freshly built
Dev with native Windows interaction. Personal remains frozen.

Implemented and validated at 8a925f5e; scope, screenshots and qualifications:
`docs/validation/WORKSPACE_SHELL_COMPACT.md`. Owner visual approval remains separate.

## SHELL-02 — Related navigation and shared backgrounds (2026-09-12)
Owner requests remaining layout corrections, meaningful grouping of related pages,
and customizable app backgrounds beyond the two currently decorated pages. Reuse
the original cosmic asset and Structure Theme colors across workspace pages;
provide procedural, optional interactive backgrounds without video, WebGL or new
dependencies. Bound rendering work, honor reduced motion/low CPU/disabled animation,
measure native cost and validate navigation, persisted choices, RTL and narrow
layouts. Retain SHELL-01 sidebar controls, original branding and truthful data.
Dev-only implementation and QA; Personal stays frozen.

SHELL-02 implemented and verified at a42f1ab6. Architecture, exact checks, native
captures and performance qualifications: docs/validation/WORKSPACE_BACKGROUNDS_NAVIGATION.md.

## SHELL-03 — Compact provider workspace, identity controls and background library (2026-09-12)
Owner requests tighter page headers, safe provider-panel gutters, a draggable provider
list divider, hover/focus-only resize handles and unified thin scrollbars. Replace
provider enabled checkboxes and toggle checkmarks with theme/brand-colored switches;
keep enabled distinct from authenticated and show enabled unconnected providers.
Expand primary navigation to at least eight useful existing pages, including standalone
About. Upgrade About. Add All/Static/Animated/My backgrounds filters, multiple batches
of original lightweight backgrounds and device import/persist/delete for custom images.
Preserve original logos, truthful status and prior reduced-motion/low-CPU/visibility
budgets. Work in Dev; no Personal deployment or credential mutations for QA.

SHELL-03 implemented and verified at code candidate d0bb0165: eight primary pages,
compact resizable provider workspace, logo-aligned switches, 28 bundled background
choices and managed local imports. Exact source gates, native proof and limitations:
docs/validation/WORKSPACE_LIBRARY_PROVIDER_LAYOUT.md.

## SHELL-04 — interaction recovery, cinematic backgrounds and monitoring studio (2026-09-12)
Owner rejects gradient-only backgrounds and reports a displaced settings select.
Fix shared control positioning and audit interactive controls with explicit tested,
blocked and unavailable coverage. Provide detailed galaxy/planet/space imagery,
real bounded interactive animated scenes and an app-wide backdrop. Preserve logos.
Repair Windows notification app branding and provider-specific imagery where the
platform permits. Add configurable per-provider tray icons selecting one real limit,
used/remaining display, multiple professional icon designs and up to three tooltip
limits; configurable name/plan/token range with honest availability and coverage.
Move floating surfaces/bar customization out of Settings into a main studio;
consolidate related Appearance/provider/reset editors instead of redundant pages.
Keep general Settings focused. Verify native Dev behavior, restore QA changes,
and open the updated Dev app for the owner. No Personal changes or fabricated data.

Implementation/evidence through 45fbeab6:
docs/validation/SHELL04_MONITORING_AND_SPACE_WORKSPACE.md. Normal Dev relaunched
with QA settings restored. Remaining acceptance: actual Windows toast-header and
tray hover/click pixels (desktop access unavailable); live credential workflows
were not submitted. Full source tests and bounded native control coverage passed.
## QA-05 — comprehensive feature, visual, security and installer audit (2026-09-13)
2026-09-13 owner clarification: explicitly authorizes repairing the global QA
adapter's restrictions to support this application; prioritize real native app
testing, not isolated browser-only proof. Repair multi-process WebView ownership
and semantic UIA patterns while preserving unrelated-window, physical-input,
Pause/Resume and expected-value protections. Original adapter backed up before edits.
Owner requests a full control/feature inventory and human-style visual testing
through the installed guarded Desktop Visual QA stack, with Demo data for safe
scenario coverage. Inspect layouts/themes/colors/tray, all settings and feature
states, software/data-security boundaries and installer/upgrade readiness. Find
and repair reproducible defects; report inactive/unsupported features, changes,
coverage and remaining gaps honestly. Preserve Personal and real credentials.
Latest input boundary supersedes previous Cua/CDP automation permission: no
physical mouse; no standing keyboard permission; no direct engine/connector
bypass. Use inspected HWND/PID/unique UIA selector for native changes, preserve
observed user values, stop adapter in finally. Other Windows versions/architectures
require actual compatible test environments; do not claim universal compatibility.

QA05 additional owner request: use an independent Windows sandbox if available.
Environment discovery found no Windows Sandbox executable and Hyper-V VM
inventory was denied to the execution account. All reported native QA ran on
Dev on this host, not on a claimed independent machine. No installer execution
or universal Windows-version claim is authorized by evidence alone.

## PRODUCT-06 — owner identity, accounts and release completion (2026-09-13)

Owner goal and nine annotated images in attachment a1b9a0ea-572d-4b97-b18b-f545775e34b7
extend QA-05. Full acceptance remains open:

- P06-01: legible original provider logos including Alibaba across backgrounds and tray.
- P06-02: remove annotated layout voids in General, Notifications and Appearance;
  make Menu Bar a complete bounded section with bottom clearance; compact Profiles.
- P06-03: repair missing Codex command during additional-account sign-in; show each
  account as its own reorderable provider instance with customizable ordinal badge.
- P06-04: verify supported API, manual cookie and browser import flows; discover
  supported browsers and their profiles accurately, without leaking credentials.
- P06-05: original app logo and selected finish propagate to notifications, native
  windows/taskbar and other identity surfaces; prove platform behavior.
- P06-06: add new structure/theme/background batches; remove falsely animated
  static duplicates and prove actual motion for every animated category.
- P06-07: more legible tray designs, multiple independent provider/account icons,
  and per-icon enable/disable controls with native proof.
- P06-08: richer Profiles and Collections customization and verified workflows.
- P06-09: in-product/workflow documentation for every main area, especially design,
  customization, themes, profiles, collections and account distinctions.
- P06-10: redesign About; credit Mohammed Modhish's Quotalis work accurately while
  retaining upstream attribution; list only tools actually integrated. Include an
  accessible WhatsApp icon link to https://wa.me/966570966094 as expressly requested.
- P06-11: professional GitHub repository/release/download artifacts and installer
  validation. Before publishing, verify the authenticated GitHub account owns
  mmimodhish@gmail.com; never publish to a different or unverified account.
- P06-12: current source gates, native screenshot comparisons, security review and
  requirement-by-requirement evidence; no broad PASS based on partial coverage.

Image mapping: 1 General grid void; 2 Notifications void; 3 Menu Bar disclosure;
4 vertical logo-finish controls; 5 Profiles alignment; 6 Codex command-not-found;
7 notification header icon; 8 About attribution/layout; 9 native tray legibility.

P06-11 owner clarification (2026-09-13): the owner explicitly confirmed the
GitHub account shown in their screenshot is iModhish1, matching the authenticated
CLI account. This resolves the intended publishing-account ambiguity by direct
owner confirmation. The private email was not technically verified; do not claim
otherwise. Bind eventual repository writes to iModhish1 and recheck authenticated
identity immediately before publishing. Release readiness gates remain required.


P06-13 owner extension (2026-09-13): show reset inventory beneath provider logos
and consistently on all reset-related surfaces: `+1 Reset`, `+N Resets` (N >= 2),
and `No Reset` for a confirmed zero. Distinguish provider-issued resets from
Banked Reset cards; expose the last reset, the next weekly reset, available banked
cards and each card's expiry. Never infer global/company-issued cause from a
single-account quota drop, invent an expiry (including a presumed month), or
turn unsupported/missing inventory into zero. Preserve per-account attribution
and label unavailable evidence explicitly. Implement shared semantics and UI,
then cover known zero/one/multiple/unknown/expired cards plus native visuals.

P06-14 owner extension (2026-09-13): expose all eight physical logo-relative
positions (top/bottom left/right plus top/bottom/left/right center) for account
numbers and reset indicators. Dashboard rearrangement uses left/right labels
with matching physical movement in RTL. Replace the linear rail with a bounded
circular carousel showing a configurable three or four providers (fewer only on
narrow screens), wheel/keyboard controls, and persisted instance order and last
visible anchor across page/app restarts. Preserve brand marks, account isolation,
Demo separation and reduced-motion behavior; no continuously running animation.

P06-14 follow-up: retain all eight existing physical positions and persisted
three/four-card circular foreground. Close the circular reorder seam (first/last
items must remain movable left/right), and apply the app animation preference as
well as OS reduced motion. Verify these changes against the current Dev build;
existing implementation and test counts alone are not native acceptance.

P06-15 owner priority update (2026-09-13): accelerate completion and publishing
to the confirmed owner's GitHub. Deliver more than one suitable download format
and evaluate OS/architecture support honestly; package only combinations actually
built and verified. Include professional screenshots of the real themes and
structures in the repository, and retain the requested new design/background
batches. Urgency changes delivery priority, not the truth/security/QA gates.
The authenticated actor was rechecked as iModhish1; canonical repository
iModhish1/Quotalis does not yet exist as of this check. No publication occurred.

P06-16 owner extension (2026-09-13): add a dedicated persistent notification
center with a red unread-count badge, capping the display at +99 above 99.
Include all app/provider/reset alerts whether or not a native toast was shown,
with separate event/received times, per-item and mark-all-read actions, useful
filters/search and practical history controls. Include a clearly distinguished,
redacted technical-log view. Recover notifications after restart and backfill
offline events only where a provider or retained observation proves them; mark
late discovery and unavailable original timestamps instead of fabricating events
while the device/app was off. Preserve account identity, Demo isolation, dedup,
bounded retention and secret redaction. Native UI, persistence, unread counts,
offline recovery and all alert producer paths require acceptance evidence.

P06-16 expanded objective file (2026-09-13), source attachment
02e907f4-bf6a-40f7-8112-d22fa89cda69/goal-objective.md: perform a startup
reconciliation of new observations/details, reset inventory arrivals and sudden
reset evidence against the last persisted observations. Add granular notification
preferences per provider/account/model/physical limit (including Codex Spark
weekly and five-hour limits separately from ordinary weekly/five-hour limits),
event types and sound selection. Add a varied sound catalog with preview and
practical controls. Offline event time and cause still require evidence; a quota
drop alone cannot prove a company-wide reset. Keep delivery, stored history and
read state separate so muted toasts do not silently erase the event history.
Latest objective attachment 5f46054a-7d34-47d8-a851-a6ff8e5689d9/goal-objective.md
explicitly requires independent on/off switches for each such physical-limit
notification subscription, including each Spark limit, not only one provider
master switch. This clarifies and retains all preceding P06 requirements.

P06-17 owner review gate (2026-09-13), objective attachment
66c64052-a4cb-48b7-b9a0-8ab9e1e93a05/goal-objective.md: finish and improve About
first, with Mohammed Modhish's contribution, original branding, contact and
accurate project/tool credits. Show the actual page and wait for the owner's
opinion/acceptance before building final downloads or publishing to GitHub.
Dev-only preview builds needed to inspect the page are not release candidates.
Existing local candidates remain unpublished. Improve repository presentation,
screenshots and discoverability honestly; do not promise star counts. All earlier
requirements, including the notification center, remain active.

P06-17 revised (2026-09-13), objective c84e5c07-8d3d-47a0-94b9-bab344be9805:
owner rejected the first About layout. Product/version/release/update details
must lead; move creator credit to the final footer: Made by Mohammed Modhish
(iModhish1), a prominent purple glow, and the owner's GitHub profile image.
Footer contact group: Contact us with WhatsApp and Telegram @iModhish_1 links;
third icon links to the canonical GitHub project. Preserve original Quotalis mark.
The owner now explicitly authorizes beginning publication after these corrections
and verification, superseding the earlier second-approval wait. All other release
truth, privacy, account verification and product requirements remain in effect.

P06-17 further revised (2026-09-13), objective 8d55a534-fa79-4ede-a601-6258aea26d6c:
retain the product-first layout and final creator footer. Add animated purple
flame-like glow to the creator name/avatar, with hover/press feedback. Add the
TAWAJUD AI employer link and unmodified official mark from tawajud.net, using its
verified blue/violet palette. Respect reduced motion and avoid permanent idle
render loops. Contact/project links and direct-publication authorization remain.

P06-05/17 publication gate, objective ae46db11-c88d-408a-b0eb-c8978f343a25:
the Windows notification header still lacks the application icon. Fix the app
identity/header mark (distinct from provider message artwork) and inspect native
notification evidence before publication. Do not mark an icon-path/code change
as proof that Windows actually renders the header icon.

P06-17 public presentation clarification (2026-09-14): the owner requests
features-focused GitHub project and release pages. Keep defect inventories,
unfinished-work lists and QA reports internal. Public copy should describe
verified features, product imagery, downloads and essential runtime requirements;
never claim unsupported capabilities or turn internal validation into marketing.

P06-17 publication result (2026-09-14): public source and stable v0.11.0 released
at https://github.com/iModhish1/Quotalis with features-first README/release notes,
native Demo screenshot, Windows installer, portable ZIP, separate CLI ZIP and
SHA256 manifest. Published links return HTTP 200 and asset digests match the
verified build. Internal evidence: docs/validation/QUOTALIS_0_11_0_PUBLICATION.md.
This closes publication/public-presentation only, not remaining product QA rows.

## M — Master product completion request (2026-09-14, Claude)

Owner requests a 71-section end-to-end completion: legal/OSS cleanup,
structure/theme composition system, Tray Studio, notifications, backgrounds,
loading UX, provider onboarding hardening, IA consolidation, product-wide QA
and a Codex publish handoff, targeting a future v0.12.0. Reconciliation found
local HEAD had already advanced 30+ commits past this session's prior
knowledge (About/notifications/carousel/profiles/collections/publication),
and v0.11.0 was already published to GitHub today by prior work — see
`docs/validation/QUOTALIS_0_11_0_PUBLICATION.md`.

Given the request's real scope (multiple weeks), this session selected one
evidence-backed slice rather than claiming full completion: a file-by-file
legal/open-source provenance audit and a rebrand-string cleanup pass (five
real user-facing "QuotaArc" strings fixed, including one functional CLI-name
bug, at commit `cd7dcc3c`). Full mapping of the remaining 71 sections against
this ledger's existing rows, and honest PARTIAL verdict:
`docs/validation/QUOTALIS_MASTER_PRODUCT_AUDIT.md` and
`docs/validation/LEGAL_OPEN_SOURCE_AUDIT.md`. M01 (open): the structure/theme/
tray/background/provider/IA feature work itself remains a future session's
work, to be picked up as its own bounded slice per this project's established
pattern — not inferred as started from this audit alone.

### M — Continuation Wave 1 (2026-09-14): Structure closure, theme
composition, loading UX

Owner requests a 36-section wave: structure/surface system closure (registry
inventory, unified header/drag/pin/close, safe-area system, identity
stability, native visual QA), theme composition (application-scope Apply
dialog), and product-wide loading UX. Real work completed this wave:

- **Legal quick-close** (commit `70531577`): `LICENSE` copyright line,
  `THIRD_PARTY_NOTICES.md` current-product prose and `rust/Cargo.toml`
  authorship updated from QuotaArc/CodexBar to Quotalis/Mohammed Modhish.
  Compatibility identifiers (AUMID, data roots, installer identity) verified
  untouched. Upstream attribution (Peter Steinberger, Adem Isler) unchanged.
- **Structure registry audit** (`docs/validation/STRUCTURE_SYSTEM_AUDIT.md`):
  the real current registry is 14 forms across three render paths
  (FlowSurface direct, ReelSurface, NotchSurface/NotchDetails) sharing one
  native window — not the historical Ribbon/Cradle/Deck/Satellite/Flowline/
  Orbit Reel/Horizon/Petal example list.
- **Structure Pin/Close consistency fix** (commit `a26e8ffb`): found and
  fixed a real three-way drift — ReelSurface still used a stale `⌖` pin
  glyph with a static (accessibility-broken) label; NotchDetails used plain
  text with no icon and a differently-worded Close label. Extracted one
  shared `StructurePinButton` (`design-system/StructureControls.tsx`) used
  by all three render paths, with regression tests.
- **Loading-state audit, partial** (`docs/validation/LOADING_STATE_MATRIX.md`):
  confirmed the shared Analytics data hook already implements "don't blank
  valid cached data on same-scope refresh" and keeps loading/unavailable/
  zero/error distinct; a unified shared visual loading-language component
  set remains unbuilt.

**Not completed this wave** (honestly open, not claimed done): the safe-area
token system; reproducing/fixing the owner's other screenshot categories
(detached-looking orbs, clipped text/icons, excessive anchor gaps, hard
clipping); the theme-composition Apply-scopes dialog and per-scope
persistence (owner §17–23); a native visual QA matrix across all 14
structures; large-provider-count structure fixtures. See
`docs/validation/STRUCTURE_SYSTEM_AUDIT.md` and
`docs/validation/LOADING_STATE_MATRIX.md` for the exact scoping. Remaining
sequence: `docs/validation/CLAUDE_EXECUTION_SEQUENCE.md`.

WAVE3 (2026-09-22) — Provider onboarding continuation. Base d066226d9edb;
existing uncommitted Wave3 implementation preserved and reconciled. User spec:
CLI/cookies/API keys/device OAuth/local sources, one derived capability model,
connection verification and state, cancellation/single-flight, protected credentials,
all-provider fixtures/stress, security audit, native-QA handoff and verified Dev build.
Accepted Waves1/2 remain intact unless integration demonstrates a regression.
Native screenshot/UIA/CDP work remains explicitly deferred; do not retry known
blocked paths. No publishing, Personal promotion or Personal credential access.
Execution: reconcile → repair identified security/lifecycle defects → complete
production flow/status/disconnect and fixture isolation → all-provider regression
and full gates → coherent commits → canonical verified Dev build. Release gate CLOSED.


## Master Goal continuation — 2026-09-22

The owner's two master documents extend execution through remaining Wave 3, product completion, historical/cross-wave reconciliation, security/OSS and release preparation. Track the full objective in `docs/validation/GOAL_MODE_MASTER_EXECUTION.md`; no earlier requirement is silently dropped. Current increment closes Dev simulated login, cancellation finalization and simulated-success/live-refresh isolation, with generic challenge errors and regression coverage. Full tests pass (frontend1564/228, desktop561+1ignored, core1858, CLI1). Native remains deferred and release CLOSED. Next: verify capability reporting declarations and complete remaining registry/scenario reliability coverage; then historical reconciliation and product-completion work. Goal remains ACTIVE, not complete.

### Reporting evidence checkpoint — 2026-09-22
Wave 3 reporting now requires observed response evidence; no legacy reset/cost guarantee. OpenRouter spend-only and Antigravity unknown/empty quota rows remain informational, and known zero remains valid. Independent review and adapter/bridge regressions completed. Current tests: frontend1568/228, desktop564+1existingignored, core1860, CLI1; TypeScript/build/clippy/fmt/secret/diff checks pass. Native remains deferred, release CLOSED. CROSS_WAVE_REGRESSION_MATRIX.md now tracks22mandatory interactions plus the repaired observation flow; full historical reconciliation and remaining provider capability/scenario audit remain open. Canonical post-commit Dev identity must be captured before treating the binary as current.

### Historical inventory and connection-method checkpoint — 2026-09-22
All three historical ledgers have been read completely. ALL_WAVES_RECONCILIATION_MATRIX.md now preserves the original phases, numbered families and superseded decisions with current implementation/test anchors and explicit acceptance gaps; CROSS_WAVE_REGRESSION_MATRIX.md remains the interaction gate. Credential cancellation and unsupported browser offerings are repaired. The current source also preserves actual API-key/device/CLI provenance across desktop and CLI, with independent review and full tests (frontend1568/228, desktop569+1existingignored, core1868, CLI1). No native/live-auth or full Wave3 PASS is claimed. Next: harden the preexisting raw Copilot gh-token fetch through the trusted bounded runner; finish remaining provider scenario/capability/stress work, then Product Completion and release gates. Personal and published v0.11.0 remain unchanged.
