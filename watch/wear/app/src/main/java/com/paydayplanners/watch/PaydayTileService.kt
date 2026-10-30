package com.paydayplanners.watch

import androidx.wear.protolayout.ActionBuilders.AndroidActivity
import androidx.wear.protolayout.ActionBuilders.LaunchAction
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.LayoutElementBuilders.Column
import androidx.wear.protolayout.LayoutElementBuilders.Spacer
import androidx.wear.protolayout.TimelineBuilders.Timeline
import androidx.wear.protolayout.layout.androidImageResource
import androidx.wear.protolayout.layout.imageResource
import androidx.wear.protolayout.material3.MaterialScope
import androidx.wear.protolayout.material3.ColorScheme
import androidx.wear.protolayout.material3.Typography.TITLE_MEDIUM
import androidx.wear.protolayout.material3.icon
import androidx.wear.protolayout.material3.primaryLayout
import androidx.wear.protolayout.material3.text
import androidx.wear.protolayout.material3.textEdgeButton
import androidx.wear.protolayout.modifiers.clickable
import androidx.wear.protolayout.types.layoutString
import androidx.wear.protolayout.types.argb
import androidx.wear.tiles.Material3TileService
import androidx.wear.tiles.RequestBuilders.TileRequest
import androidx.wear.tiles.TileBuilders.Tile
import androidx.wear.tiles.tile

/** A swipe-accessible app launcher that works without a network or paired account. */
class PaydayTileService : Material3TileService(
    allowDynamicTheme = false,
    defaultColorScheme = ColorScheme(
        primary = 0xFFB8F3CD.toInt().argb,
        onPrimary = 0xFF17241C.toInt().argb,
        onSurface = 0xFFFFFFFF.toInt().argb,
        onSurfaceVariant = 0xFFA8B4AC.toInt().argb
    )
) {
    override suspend fun MaterialScope.tileResponse(requestParams: TileRequest): Tile = tile(
        timeline = Timeline.fromLayoutElement(
            primaryLayout(
                titleSlot = { text(getString(R.string.tile_label).layoutString) },
                mainSlot = {
                    Column.Builder()
                        .addContent(icon(
                            imageResource(androidImageResource(R.drawable.ic_payday_complication)),
                            width = dp(40f), height = dp(40f), tintColor = colorScheme.primary
                        ))
                        .addContent(Spacer.Builder().setHeight(dp(8f)).build())
                        .addContent(text(
                            getString(R.string.tile_headline).layoutString,
                            typography = TITLE_MEDIUM, color = colorScheme.onSurface
                        ))
                        .build()
                },
                bottomSlot = {
                    textEdgeButton(
                        onClick = clickable(
                            action = LaunchAction.Builder().setAndroidActivity(
                                AndroidActivity.Builder()
                                    .setPackageName(packageName)
                                    .setClassName(MainActivity::class.java.name)
                                    .build()
                            ).build()
                        ),
                        labelContent = { text(getString(R.string.tile_open_app).layoutString) }
                    )
                }
            )
        )
    )
}
