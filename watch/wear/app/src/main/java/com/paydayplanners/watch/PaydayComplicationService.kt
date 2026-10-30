package com.paydayplanners.watch

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Intent
import android.graphics.drawable.Icon
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.LongTextComplicationData
import androidx.wear.watchface.complications.data.MonochromaticImage
import androidx.wear.watchface.complications.data.MonochromaticImageComplicationData
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.data.SmallImage
import androidx.wear.watchface.complications.data.SmallImageComplicationData
import androidx.wear.watchface.complications.data.SmallImageType
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService

/** A static launcher; no account data or periodic background work is needed. */
class PaydayComplicationService : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? =
        complicationData(request.complicationType, openAppAction())

    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        complicationData(type, null)

    private fun openAppAction(): PendingIntent {
        val intent = Intent.makeMainActivity(ComponentName(this, MainActivity::class.java))
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun complicationData(type: ComplicationType, tapAction: PendingIntent?): ComplicationData? {
        val description = PlainComplicationText.Builder(getString(R.string.complication_label)).build()
        val icon = Icon.createWithResource(this, R.drawable.ic_payday_complication)
        val image = MonochromaticImage.Builder(icon).build()
        return when (type) {
            ComplicationType.SHORT_TEXT -> ShortTextComplicationData.Builder(
                PlainComplicationText.Builder(getString(R.string.complication_short_text)).build(), description
            ).setMonochromaticImage(image).setTapAction(tapAction).build()
            ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(
                PlainComplicationText.Builder(getString(R.string.complication_long_text)).build(), description
            ).setMonochromaticImage(image).setTapAction(tapAction).build()
            ComplicationType.MONOCHROMATIC_IMAGE -> MonochromaticImageComplicationData.Builder(
                image, description
            ).setTapAction(tapAction).build()
            ComplicationType.SMALL_IMAGE -> SmallImageComplicationData.Builder(
                SmallImage.Builder(icon, SmallImageType.ICON).build(), description
            ).setTapAction(tapAction).build()
            else -> null
        }
    }
}
