import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import { SynozaLogo } from '../components/SynozaLogo';
import { ThemeToggle } from '../components/ThemeToggle';

export default function RefundPolicyPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#060b14] flex flex-col">
      <header className="px-5 sm:px-8 py-5 flex items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ChevronLeft size={18} />
          {t('portalBackHome')}
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <SynozaLogo height={48} to="/" />
        </div>
      </header>

      <main className="flex-1 px-4 pb-16">
        <article
          className="mx-auto max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm px-6 sm:px-10 py-10"
          dir="ltr"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400 mb-2">
            Synoza
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Refund & Return Policy
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
            Last updated: 21 July 2026
          </p>

          <EnglishPolicyBody />
        </article>
      </main>
    </div>
  );
}

function ArabicPolicyBody() {
  return (
    <div className="space-y-8 text-[15px] leading-8 text-slate-700 dark:text-slate-300">
      <p>نشكر لك استخدام منصتنا.</p>
      <p>
        نظرًا لأن خدماتنا عبارة عن اشتراكات رقمية تتيح الوصول الفوري إلى محتوى تعليمي، فإن جميع
        الاشتراكات تعتبر نهائية بعد تفعيلها.
      </p>

      <section>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">متى يمكن استرداد المبلغ؟</h2>
        <p className="mb-3">يحق للمستخدم طلب استرداد كامل للمبلغ في الحالات التالية:</p>
        <ul className="list-disc pr-6 space-y-2">
          <li>تم خصم المبلغ أكثر من مرة عن نفس الاشتراك.</li>
          <li>
            تم الدفع ولم يتم تفعيل الاشتراك بسبب خطأ تقني من جانب المنصة ولم يتم حل المشكلة خلال فترة
            معقولة.
          </li>
          <li>تم تحصيل مبلغ بالخطأ نتيجة مشكلة في نظام الدفع.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
          الحالات التي لا يتم فيها الاسترداد
        </h2>
        <p className="mb-3">لا يمكن استرداد قيمة الاشتراك إذا:</p>
        <ul className="list-disc pr-6 space-y-2">
          <li>تم تفعيل الاشتراك واستخدام المنصة.</li>
          <li>غيّر المستخدم رأيه بعد الشراء.</li>
          <li>لم يحقق المحتوى توقعات المستخدم.</li>
          <li>لم يستخدم المستخدم الاشتراك بعد تفعيله.</li>
          <li>انتهت مدة الاشتراك.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">طلب الاسترداد</h2>
        <p className="mb-3">يجب إرسال طلب الاسترداد خلال 7 أيام من تاريخ الدفع مع إرفاق:</p>
        <ul className="list-disc pr-6 space-y-2">
          <li>الاسم.</li>
          <li>البريد الإلكتروني.</li>
          <li>رقم عملية الدفع أو إيصال الدفع.</li>
          <li>سبب الطلب.</li>
        </ul>
        <p className="mt-3">سيتم مراجعة الطلب والرد خلال 5 أيام عمل.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">طريقة رد المبلغ</h2>
        <p>
          في حال الموافقة على الطلب، سيتم رد المبلغ بنفس وسيلة الدفع المستخدمة كلما أمكن ذلك، وقد
          تستغرق عملية التحويل عدة أيام عمل حسب مزود خدمة الدفع.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">التواصل</h2>
        <p>
          لأي استفسار بخصوص الاسترجاع، يمكن التواصل مع فريق الدعم من خلال البريد الإلكتروني أو صفحة
          الدعم داخل المنصة.
        </p>
      </section>
    </div>
  );
}

function EnglishPolicyBody() {
  return (
    <div className="space-y-8 text-[15px] leading-7 text-slate-700 dark:text-slate-300">
      <p>Thank you for using our platform.</p>
      <p>
        Because our services are digital subscriptions that provide immediate access to educational
        content, all subscriptions are final once activated.
      </p>

      <section>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">When is a refund available?</h2>
        <p className="mb-3">A user may request a full refund in the following cases:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>The amount was charged more than once for the same subscription.</li>
          <li>
            Payment was completed but the subscription was not activated due to a technical error on
            the platform’s side, and the issue was not resolved within a reasonable period.
          </li>
          <li>An amount was collected by mistake due to a payment-system problem.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Non-refundable cases</h2>
        <p className="mb-3">Subscription fees are not refundable if:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>The subscription was activated and the platform was used.</li>
          <li>The user changed their mind after purchase.</li>
          <li>The content did not meet the user’s expectations.</li>
          <li>The user did not use the subscription after activation.</li>
          <li>The subscription period has ended.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">How to request a refund</h2>
        <p className="mb-3">
          Refund requests must be submitted within 7 days of the payment date and include:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Full name.</li>
          <li>Email address.</li>
          <li>Payment transaction number or receipt.</li>
          <li>Reason for the request.</li>
        </ul>
        <p className="mt-3">Requests will be reviewed and answered within 5 business days.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Refund method</h2>
        <p>
          If the request is approved, the amount will be refunded to the original payment method
          whenever possible. The transfer may take several business days depending on the payment
          provider.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Contact</h2>
        <p>
          For any refund-related inquiry, please contact support by email or through the in-platform
          support page.
        </p>
      </section>
    </div>
  );
}
